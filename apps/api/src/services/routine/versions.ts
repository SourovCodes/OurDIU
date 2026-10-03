import {
  routineMinutes,
  type AdminRoutineVersion,
  type AdminRoutineVersionDetail,
  type RoutineDepartment,
  type RoutineFile,
} from "@ourdiu/shared";
import { and, asc, desc, eq, getTableColumns } from "drizzle-orm";
import type { Database } from "../../db/client";
import {
  routineClasses,
  routineCourses,
  routineVersions,
  user,
  type RoutineVersionRow,
} from "../../db/schema";
import { isConstraintError } from "../../lib/db-errors";
import { AppError } from "../../lib/errors";
import {
  MAX_STORED_WARNINGS,
  routineChanges,
  routineWarnings,
  type CheckedClass,
} from "./check";

// Routine versions for admins: upload a file as a draft, review it against the live
// version, make it live (one per department), delete drafts.

/** Classes go into D1 in chunks, each one JSON parameter (D1 takes 100 per query). */
const INSERT_CHUNK = 1000;

const newFileKey = () => `routine/versions/${crypto.randomUUID()}.json`;

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function toAdminVersion(
  row: RoutineVersionRow & { uploaderName: string | null },
): AdminRoutineVersion {
  return {
    id: row.id,
    department: row.department,
    version: row.version,
    publishedOn: row.publishedOn,
    source: row.source,
    status: row.status,
    sectionCount: row.sectionCount,
    classCount: row.classCount,
    warningCount: row.warnings.length,
    uploadedBy: row.uploaderName === null ? null : { name: row.uploaderName },
    createdAt: row.createdAt.toISOString(),
    liveAt: iso(row.liveAt),
    replacedAt: iso(row.replacedAt),
  };
}

function versionQuery(db: Database) {
  return db
    .select({ ...getTableColumns(routineVersions), uploaderName: user.name })
    .from(routineVersions)
    .leftJoin(user, eq(user.id, routineVersions.uploadedBy));
}

export async function listRoutineVersions(
  db: Database,
): Promise<AdminRoutineVersion[]> {
  const rows = await versionQuery(db).orderBy(
    asc(routineVersions.department),
    desc(routineVersions.createdAt),
    desc(routineVersions.id),
  );
  return rows.map(toAdminVersion);
}

async function findVersion(db: Database, id: number) {
  const [row] = await versionQuery(db).where(eq(routineVersions.id, id));
  if (!row) {
    throw new AppError(404, "NOT_FOUND", "Routine version not found");
  }
  return row;
}

async function loadClasses(db: Database, versionId: number) {
  return db
    .select({
      day: routineClasses.day,
      start: routineClasses.start,
      end: routineClasses.end,
      course: routineClasses.course,
      section: routineClasses.section,
      labGroup: routineClasses.labGroup,
      room: routineClasses.room,
      teacher: routineClasses.teacher,
    })
    .from(routineClasses)
    .where(eq(routineClasses.versionId, versionId));
}

const checkedClasses = (file: RoutineFile): CheckedClass[] =>
  file.classes.map((c) => ({
    day: c.day,
    start: routineMinutes(c.start),
    end: routineMinutes(c.end),
    course: c.course,
    section: c.section,
    labGroup: c.labGroup ?? null,
    room: c.room.trim(),
    teacher: c.teacher ?? null,
  }));

/**
 * Saves an uploaded routine as a draft: the file as it came in R2, its classes in D1,
 * and the warnings found in it. Students see nothing until it's made live.
 */
export async function uploadRoutineVersion(
  db: Database,
  bucket: R2Bucket,
  userId: string,
  file: RoutineFile,
  raw: string,
): Promise<AdminRoutineVersionDetail> {
  const exists = await db
    .select({ id: routineVersions.id })
    .from(routineVersions)
    .where(
      and(
        eq(routineVersions.department, file.department),
        eq(routineVersions.version, file.version),
      ),
    );
  if (exists.length) {
    throw new AppError(
      409,
      "VERSION_EXISTS",
      `${file.department} routine version ${file.version} is already uploaded`,
    );
  }

  const classes = checkedClasses(file);
  const knownTitles = new Set([
    ...Object.keys(file.courses ?? {}),
    ...(
      await db.select({ code: routineCourses.code }).from(routineCourses)
    ).map((r) => r.code),
  ]);
  const warnings = routineWarnings(classes, knownTitles).slice(
    0,
    MAX_STORED_WARNINGS,
  );

  const fileKey = newFileKey();
  await bucket.put(fileKey, raw, {
    httpMetadata: { contentType: "application/json" },
  });

  let versionId: number;
  try {
    const [row] = await db
      .insert(routineVersions)
      .values({
        department: file.department,
        version: file.version,
        publishedOn: file.publishedOn ?? null,
        source: file.source ?? null,
        fileKey,
        slots: file.slots,
        courses: file.courses ?? {},
        teachers: file.teachers ?? {},
        warnings,
        sectionCount: new Set(classes.map((c) => c.section)).size,
        classCount: classes.length,
        uploadedBy: userId,
      })
      .returning({ id: routineVersions.id });
    versionId = row!.id;
  } catch (err) {
    await bucket.delete(fileKey);
    if (isConstraintError(err, "UNIQUE")) {
      throw new AppError(
        409,
        "VERSION_EXISTS",
        `${file.department} routine version ${file.version} is already uploaded`,
      );
    }
    throw err;
  }

  try {
    const rows = classes.map((c, i) => ({
      ...c,
      roomType: file.classes[i]!.roomType ?? null,
    }));
    // Raw D1 statements: Drizzle's batch can't run raw SQL with parameters.
    const client = db.$client;
    const insert = client.prepare(`
      insert into routine_classes
        (version_id, day, start, "end", course, section, lab_group, room, room_type, teacher)
      select ?1, value ->> 'day', value ->> 'start', value ->> 'end',
        value ->> 'course', value ->> 'section', value ->> 'labGroup',
        value ->> 'room', value ->> 'roomType', value ->> 'teacher'
      from json_each(?2)`);
    const statements: D1PreparedStatement[] = [];
    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
      statements.push(
        insert.bind(versionId, JSON.stringify(rows.slice(i, i + INSERT_CHUNK))),
      );
    }
    await client.batch(statements);
  } catch (err) {
    await db.delete(routineVersions).where(eq(routineVersions.id, versionId));
    await bucket.delete(fileKey);
    throw err;
  }

  return getRoutineVersion(db, versionId);
}

/** The version to compare a version with: the live one, or the one it replaced. */
async function baseline(db: Database, row: RoutineVersionRow) {
  const [base] = await db
    .select()
    .from(routineVersions)
    .where(
      row.status === "live"
        ? and(
            eq(routineVersions.department, row.department),
            eq(routineVersions.status, "previous"),
          )
        : and(
            eq(routineVersions.department, row.department),
            eq(routineVersions.status, "live"),
          ),
    )
    .orderBy(desc(routineVersions.replacedAt))
    .limit(1);
  return base && base.id !== row.id ? base : null;
}

/** A version with its warnings and what it changes from the live version. */
export async function getRoutineVersion(
  db: Database,
  id: number,
): Promise<AdminRoutineVersionDetail> {
  const row = await findVersion(db, id);
  const base = await baseline(db, row);
  const [after, before] = await Promise.all([
    loadClasses(db, row.id),
    base ? loadClasses(db, base.id) : Promise.resolve([]),
  ]);
  const changes = routineChanges(base ? before : after, after);
  return {
    ...toAdminVersion(row),
    warnings: row.warnings,
    comparedWith: base?.version ?? null,
    changes,
  };
}

/**
 * Makes a version the one students see. The department's live version becomes a
 * previous one, in the same transaction, and the version's course titles and
 * teachers' names become the ones shown.
 */
export async function makeRoutineVersionLive(
  db: Database,
  id: number,
): Promise<AdminRoutineVersionDetail> {
  const row = await findVersion(db, id);
  if (row.status !== "live") {
    const now = Date.now();
    const client = db.$client;
    // One transaction; the live one steps down first (one live per department).
    await client.batch([
      client
        .prepare(
          `update routine_versions set status = 'previous', replaced_at = ?1, updated_at = ?1
          where department = ?2 and status = 'live'`,
        )
        .bind(now, row.department),
      client
        .prepare(
          `update routine_versions set status = 'live', live_at = ?1, replaced_at = null, updated_at = ?1
          where id = ?2`,
        )
        .bind(now, id),
      client
        .prepare(
          `insert into routine_courses (code, title)
          select key, value from json_each(?1) where true
          on conflict (code) do update set title = excluded.title, updated_at = ?2`,
        )
        .bind(JSON.stringify(row.courses), now),
      client
        .prepare(
          `insert into routine_teachers (initials, name)
          select key, value from json_each(?1) where true
          on conflict (initials) do update set name = excluded.name, updated_at = ?2`,
        )
        .bind(JSON.stringify(row.teachers), now),
    ]);
  }
  return getRoutineVersion(db, id);
}

/** Deletes a draft with its classes and file. Versions that were live stay. */
export async function deleteRoutineVersion(
  db: Database,
  bucket: R2Bucket,
  id: number,
) {
  const row = await findVersion(db, id);
  if (row.status !== "draft") {
    throw new AppError(
      409,
      "NOT_A_DRAFT",
      "Only drafts can be deleted; this version has been live",
    );
  }
  await db.delete(routineVersions).where(eq(routineVersions.id, id));
  await bucket.delete(row.fileKey);
}

/** The file a version was uploaded as. */
export async function getRoutineVersionFile(
  db: Database,
  bucket: R2Bucket,
  id: number,
) {
  const row = await findVersion(db, id);
  const object = await bucket.get(row.fileKey);
  if (!object) {
    throw new AppError(404, "NOT_FOUND", "The uploaded file is missing");
  }
  return {
    object,
    filename: `${row.department.toLowerCase()}-routine-${row.version}.json`,
  };
}

/** The live version of a department's routine, if there is one. */
export async function liveRoutineVersion(
  db: Database,
  department: RoutineDepartment,
) {
  const [row] = await db
    .select()
    .from(routineVersions)
    .where(
      and(
        eq(routineVersions.department, department),
        eq(routineVersions.status, "live"),
      ),
    );
  return row ?? null;
}
