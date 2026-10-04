import {
  ROUTINE_DAYS,
  routineTime,
  type RoutineDay,
  type RoutineDepartment,
  type RoutineTeacherClass,
  type RoutineTeacherList,
  type RoutineTeacherWeek,
} from "@ourdiu/shared";
import { and, count, eq, isNotNull, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import {
  routineClasses,
  routineCourses,
  routineTeachers,
} from "../../db/schema";
import { AppError } from "../../lib/errors";
import { compareSections } from "./check";
import { requireLive, toVersion } from "./sections";

// What anyone reads about a teacher: their week in the live routine, the sections
// they teach in place of the teacher a section's week shows.

/** Every teacher in the live routine, for finding one by initials or name. */
export async function listRoutineTeacherSummaries(
  db: Database,
  department: RoutineDepartment,
): Promise<RoutineTeacherList> {
  const version = await requireLive(db, department);
  const rows = await db
    .select({
      initials: routineClasses.teacher,
      name: routineTeachers.name,
      courses: sql<string>`group_concat(distinct ${routineClasses.course})`,
      classCount: count(),
    })
    .from(routineClasses)
    .leftJoin(
      routineTeachers,
      and(
        eq(routineTeachers.department, department),
        eq(routineTeachers.initials, routineClasses.teacher),
      ),
    )
    .where(
      and(
        eq(routineClasses.versionId, version.id),
        isNotNull(routineClasses.teacher),
      ),
    )
    .groupBy(routineClasses.teacher);
  return {
    version: toVersion(version),
    teachers: rows
      .map((r) => ({
        initials: r.initials!,
        name: r.name,
        courses: r.courses.split(",").sort(),
        classCount: r.classCount,
      }))
      .sort((a, b) => a.initials.localeCompare(b.initials)),
  };
}

type TeacherRow = {
  section: string;
  day: RoutineDay;
  start: number;
  end: number;
  course: string;
  title: string | null;
  labGroup: string | null;
  room: string;
  roomType: RoutineTeacherClass["roomType"];
};

/**
 * A teacher's rows as their week, in day and time order: sections sharing a class
 * (same day, time, room and course) are one class.
 */
export function teacherClasses(rows: TeacherRow[]): RoutineTeacherClass[] {
  const classes = new Map<string, RoutineTeacherClass>();
  for (const r of [...rows].sort(
    (a, b) =>
      ROUTINE_DAYS.indexOf(a.day) - ROUTINE_DAYS.indexOf(b.day) ||
      a.start - b.start ||
      compareSections(a.section, b.section) ||
      (a.labGroup ?? "").localeCompare(b.labGroup ?? ""),
  )) {
    const key = [r.day, r.start, r.end, r.room, r.course].join("|");
    const attending = { section: r.section, labGroup: r.labGroup };
    const shared = classes.get(key);
    if (shared) {
      shared.sections.push(attending);
      continue;
    }
    classes.set(key, {
      day: r.day,
      start: routineTime(r.start),
      end: routineTime(r.end),
      course: { code: r.course, title: r.title },
      room: r.room,
      roomType: r.roomType,
      sections: [attending],
    });
  }
  return [...classes.values()];
}

/**
 * A teacher's week in the live routine, found regardless of case ("sta"). Sections
 * sharing a class (same day, time, room and course) are one class.
 */
export async function getRoutineTeacherWeek(
  db: Database,
  department: RoutineDepartment,
  initials: string,
): Promise<RoutineTeacherWeek> {
  const version = await requireLive(db, department);
  const rows = await db
    .select({
      teacher: routineClasses.teacher,
      section: routineClasses.section,
      day: routineClasses.day,
      start: routineClasses.start,
      end: routineClasses.end,
      course: routineClasses.course,
      title: routineCourses.title,
      labGroup: routineClasses.labGroup,
      room: routineClasses.room,
      roomType: routineClasses.roomType,
    })
    .from(routineClasses)
    .leftJoin(
      routineCourses,
      and(
        eq(routineCourses.department, department),
        eq(routineCourses.code, routineClasses.course),
      ),
    )
    .where(
      and(
        eq(routineClasses.versionId, version.id),
        sql`${routineClasses.teacher} = ${initials} collate nocase`,
      ),
    );
  if (!rows.length) {
    throw new AppError(
      404,
      "TEACHER_NOT_FOUND",
      `${initials} doesn't teach in the ${department} routine ${version.version}`,
    );
  }
  // Two teachers' initials differing only in case: prefer the exact one.
  const printed =
    rows.find((r) => r.teacher === initials)?.teacher ?? rows[0]!.teacher!;
  const [details] = await db
    .select()
    .from(routineTeachers)
    .where(
      and(
        eq(routineTeachers.department, department),
        eq(routineTeachers.initials, printed),
      ),
    );

  return {
    version: toVersion(version),
    teacher: {
      initials: printed,
      name: details?.name ?? null,
      phone: details?.phone ?? null,
      email: details?.email ?? null,
      room: details?.room ?? null,
    },
    slots: version.slots,
    classes: teacherClasses(rows.filter((r) => r.teacher === printed)),
  };
}
