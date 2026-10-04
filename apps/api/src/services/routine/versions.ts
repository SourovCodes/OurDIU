import {
  routineMinutes,
  type AdminRoutineVersion,
  type AdminRoutineVersionDetail,
  type RoutineDepartment,
  type RoutineFile,
  type RoutineWarning,
} from "@ourdiu/shared";
import { and, asc, desc, eq, getTableColumns, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import {
  routineClasses,
  routineVersions,
  user,
  type RoutineVersionRow,
} from "../../db/schema";
import { isConstraintError } from "../../lib/db-errors";
import { AppError } from "../../lib/errors";
import {
  compareSections,
  MAX_STORED_WARNINGS,
  routineChanges,
  routineWarnings,
  type CheckedClass,
} from "./check";
import type { RoutineImport } from "./import/types";

// Routine versions for admins: read DIU's PDF into a draft, review it against the
// live version, make it live (one per department), delete drafts.

/** Classes go into D1 in chunks, each one JSON parameter (D1 takes 100 per query). */
const INSERT_CHUNK = 1000;

/** DIU's files a routine is read from: CSE's and EEE's PDFs, SWE's Excel sheet. */
const FILE_TYPES = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

/** Where a version's file goes in R2. */
const newFileKey = (kind: keyof typeof FILE_TYPES) =>
  `routine/versions/${crypto.randomUUID()}.${kind}`;

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
    warningCount: shownWarnings(row.warnings).length,
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

export async function findVersion(db: Database, id: number) {
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
 * Saves a routine read from DIU's file as a draft: the file in R2, its classes in
 * D1, and the warnings found in it, after what couldn't be read from the file
 * (`notes`). Students see nothing until it's made live.
 */
export async function uploadRoutineVersion(
  db: Database,
  bucket: R2Bucket,
  userId: string,
  { file, notes }: RoutineImport,
  original: { bytes: Uint8Array; kind: keyof typeof FILE_TYPES },
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
  const found: RoutineWarning[] = [
    ...notes.map((message) => ({
      kind: "unreadable" as const,
      message,
    })),
    ...routineWarnings(classes),
  ];
  const warnings =
    found.length > MAX_STORED_WARNINGS
      ? [
          ...found.slice(0, MAX_STORED_WARNINGS - 1),
          {
            kind: found[MAX_STORED_WARNINGS - 1]!.kind,
            message: `… and ${found.length - MAX_STORED_WARNINGS + 1} more.`,
          },
        ]
      : found;

  const fileKey = newFileKey(original.kind);
  const removeFiles = () => bucket.delete(fileKey);
  await bucket.put(fileKey, original.bytes, {
    httpMetadata: { contentType: FILE_TYPES[original.kind] },
  });

  let versionId: number;
  try {
    const [row] = await db
      .insert(routineVersions)
      .values({
        department: file.department,
        version: file.version,
        publishedOn: file.publishedOn ?? null,
        fileKey,
        slots: file.slots,
        teachers: file.teachers ?? {},
        warnings,
        sectionCount: new Set(classes.map((c) => c.section)).size,
        classCount: classes.length,
        uploadedBy: userId,
      })
      .returning({ id: routineVersions.id });
    versionId = row!.id;
  } catch (err) {
    await removeFiles();
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
    await removeFiles();
    throw err;
  }

  return getRoutineVersion(db, versionId);
}

/**
 * Warnings to show. Courses without a title were once a warning stored with the
 * version; they're counted when it's shown now (`versionCatalog`), so stay current.
 */
const shownWarnings = (warnings: RoutineWarning[]) =>
  warnings.filter((w) => w.kind !== "untitled_course");

/** How many of a version's courses have a title, and of its teachers a name. */
async function versionCatalog(db: Database, row: RoutineVersionRow) {
  const [counts] = await db.all<AdminRoutineVersionDetail["catalog"]>(sql`
    select
      count(distinct c.course) as courses,
      count(distinct case when rc.title is not null then c.course end) as titled,
      count(distinct c.teacher) as teachers,
      count(distinct case when t.name is not null then c.teacher end) as named
    from routine_classes c
    left join routine_courses rc
      on rc.department = ${row.department} and rc.code = c.course
    left join routine_teachers t
      on t.department = ${row.department} and t.initials = c.teacher
    where c.version_id = ${row.id}`);
  return counts ?? { courses: 0, titled: 0, teachers: 0, named: 0 };
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
    sections: [...new Set(after.map((c) => c.section))].sort(compareSections),
    catalog: await versionCatalog(db, row),
    warnings: shownWarnings(row.warnings),
    comparedWith: base?.version ?? null,
    changes,
  };
}

/**
 * Makes a version the one students see. The department's live version becomes a
 * previous one, in the same transaction. Teachers its PDF listed join the
 * department's teachers; for ones already there, only what's empty is filled in, so
 * an admin's edits stay.
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
          `insert into routine_teachers (department, initials, name, phone, email, updated_at)
          select ?2, key, value ->> 'name', value ->> 'phone', value ->> 'email', ?3
          from json_each(?1) where true
          on conflict (department, initials) do update set
            phone = coalesce(routine_teachers.phone, excluded.phone),
            email = coalesce(routine_teachers.email, excluded.email)`,
        )
        .bind(JSON.stringify(row.teachers), row.department, now),
    ]);
  }
  return getRoutineVersion(db, id);
}

/**
 * Deletes a version with its classes and its PDF. Deleting the live one leaves the
 * department without a routine ("coming soon") until another is made live.
 */
export async function deleteRoutineVersion(
  db: Database,
  bucket: R2Bucket,
  id: number,
) {
  const row = await findVersion(db, id);
  await db.delete(routineVersions).where(eq(routineVersions.id, id));
  await bucket.delete(row.fileKey);
}

/** Gives a version another number; each number is used once per department. */
export async function renumberRoutineVersion(
  db: Database,
  id: number,
  version: string,
): Promise<AdminRoutineVersionDetail> {
  const row = await findVersion(db, id);
  if (row.version !== version) {
    try {
      await db
        .update(routineVersions)
        .set({ version, updatedAt: new Date() })
        .where(eq(routineVersions.id, id));
    } catch (err) {
      if (isConstraintError(err, "UNIQUE")) {
        throw new AppError(
          409,
          "VERSION_EXISTS",
          `${row.department} already has a version ${version}`,
        );
      }
      throw err;
    }
  }
  return getRoutineVersion(db, id);
}

/** DIU's file a version was read from: a PDF, or SWE's Excel sheet. */
export async function getRoutineVersionPdf(
  db: Database,
  bucket: R2Bucket,
  id: number,
) {
  const row = await findVersion(db, id);
  const object = await bucket.get(row.fileKey);
  if (!object) {
    throw new AppError(404, "NOT_FOUND", "The version's file is missing");
  }
  const extension = row.fileKey.endsWith(".xlsx") ? "xlsx" : "pdf";
  return {
    object,
    filename: `${row.department.toLowerCase()}-routine-${row.version}.${extension}`,
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
