import {
  ROUTINE_DAYS,
  routineSectionSlug,
  routineTime,
  type RoutineDepartment,
  type RoutineSection,
  type RoutineSectionList,
  type RoutineVersion,
} from "@ourdiu/shared";
import { and, count, eq, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import {
  routineClasses,
  routineCourses,
  routineTeachers,
  type RoutineVersionRow,
} from "../../db/schema";
import { AppError } from "../../lib/errors";
import { compareSections } from "./check";
import { liveRoutineVersion } from "./versions";

// What students read: the live version's sections and each section's week.

function toVersion(row: RoutineVersionRow): RoutineVersion {
  return {
    department: row.department,
    version: row.version,
    publishedOn: row.publishedOn,
    source: row.source,
    liveSince: (row.liveAt ?? row.updatedAt).toISOString(),
  };
}

async function requireLive(db: Database, department: RoutineDepartment) {
  const row = await liveRoutineVersion(db, department);
  if (!row) {
    throw new AppError(
      404,
      "NO_ROUTINE",
      `There is no ${department} routine yet`,
    );
  }
  return row;
}

const splitGroups = (groups: string | null) =>
  groups ? [...new Set(groups.split(","))].sort(compareSections) : [];

/** Every section in the live routine, for finding yours. */
export async function listRoutineSections(
  db: Database,
  department: RoutineDepartment,
): Promise<RoutineSectionList> {
  const version = await requireLive(db, department);
  const rows = await db
    .select({
      section: routineClasses.section,
      labGroups: sql<
        string | null
      >`group_concat(distinct ${routineClasses.labGroup})`,
      classCount: count(),
    })
    .from(routineClasses)
    .where(eq(routineClasses.versionId, version.id))
    .groupBy(routineClasses.section);
  return {
    version: toVersion(version),
    sections: rows
      .map((r) => ({
        section: r.section,
        labGroups: splitGroups(r.labGroups),
        classCount: r.classCount,
      }))
      .sort((a, b) => compareSections(a.section, b.section)),
  };
}

/**
 * A section's week in the live routine, in day and time order. The section is found
 * regardless of case ("67_b") and with underscores for spaces ("1-2_B", as in page
 * addresses); the response has its name as printed.
 */
export async function getRoutineSection(
  db: Database,
  department: RoutineDepartment,
  section: string,
): Promise<RoutineSection> {
  return sectionOfVersion(db, await requireLive(db, department), section);
}

/** A section's week in any version, e.g. a draft an admin previews. */
export async function sectionOfVersion(
  db: Database,
  version: RoutineVersionRow,
  section: string,
): Promise<RoutineSection> {
  const rows = await db
    .select({
      section: routineClasses.section,
      day: routineClasses.day,
      start: routineClasses.start,
      end: routineClasses.end,
      course: routineClasses.course,
      title: routineCourses.title,
      labGroup: routineClasses.labGroup,
      room: routineClasses.room,
      roomType: routineClasses.roomType,
      teacher: routineClasses.teacher,
      teacherName: routineTeachers.name,
    })
    .from(routineClasses)
    .leftJoin(
      routineCourses,
      and(
        eq(routineCourses.department, version.department),
        eq(routineCourses.code, routineClasses.course),
      ),
    )
    .leftJoin(
      routineTeachers,
      and(
        eq(routineTeachers.department, version.department),
        eq(routineTeachers.initials, routineClasses.teacher),
      ),
    )
    .where(
      and(
        eq(routineClasses.versionId, version.id),
        sql`replace(${routineClasses.section}, ' ', '_') = ${routineSectionSlug(section)} collate nocase`,
      ),
    );
  if (!rows.length) {
    throw new AppError(
      404,
      "SECTION_NOT_FOUND",
      `${section} isn't in the ${version.department} routine ${version.version}`,
    );
  }
  // Two sections differing only in case: prefer the exact one.
  const name =
    rows.find((r) => r.section === section)?.section ?? rows[0]!.section;
  const classes = rows
    .filter((r) => r.section === name)
    .sort(
      (a, b) =>
        ROUTINE_DAYS.indexOf(a.day) - ROUTINE_DAYS.indexOf(b.day) ||
        a.start - b.start ||
        (a.labGroup ?? "").localeCompare(b.labGroup ?? ""),
    );
  return {
    version: toVersion(version),
    section: name,
    slots: version.slots,
    labGroups: [
      ...new Set(classes.flatMap((c) => (c.labGroup ? [c.labGroup] : []))),
    ].sort(compareSections),
    classes: classes.map((c) => ({
      day: c.day,
      start: routineTime(c.start),
      end: routineTime(c.end),
      course: { code: c.course, title: c.title },
      labGroup: c.labGroup,
      room: c.room,
      roomType: c.roomType,
      teacher: c.teacher ? { initials: c.teacher, name: c.teacherName } : null,
    })),
  };
}
