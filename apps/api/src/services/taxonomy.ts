import type { Taxonomy } from "@ourdiu/shared";
import { asc, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import {
  courseAliases,
  courses,
  departments,
  examTypes,
  semesters,
} from "../db/schema";
import { semesterRecency } from "./common";

/** Departments by name, with their number of published papers. */
export function listDepartments(db: Database) {
  return db
    .select({
      id: departments.id,
      name: departments.name,
      shortName: departments.shortName,
      publishedCount: departments.publishedCount,
    })
    .from(departments)
    .orderBy(asc(departments.name));
}

/** Courses by name, with their number of published papers. */
export function listCourses(db: Database, departmentId?: number) {
  return db
    .select({
      id: courses.id,
      name: courses.name,
      departmentId: courses.departmentId,
      publishedCount: courses.publishedCount,
    })
    .from(courses)
    .where(departmentId ? eq(courses.departmentId, departmentId) : undefined)
    .orderBy(asc(courses.name));
}

/** Ordered by id so semesters keep their natural (insertion) order. */
export function listSemesters(db: Database) {
  return db
    .select()
    .from(semesters)
    .orderBy(...semesterRecency);
}

export function listExamTypes(db: Database) {
  return db.select().from(examTypes).orderBy(asc(examTypes.name));
}

/** Every course's visible short names, for search. */
export function listCourseAliases(db: Database) {
  return db
    .select({ courseId: courseAliases.courseId, alias: courseAliases.alias })
    .from(courseAliases)
    .where(eq(courseAliases.hidden, false))
    .orderBy(asc(courseAliases.courseId), asc(courseAliases.alias));
}

/** Short names by course id. */
export function aliasesByCourse(rows: { courseId: number; alias: string }[]) {
  const byCourse = new Map<number, string[]>();
  for (const { courseId, alias } of rows) {
    const list = byCourse.get(courseId);
    if (list) list.push(alias);
    else byCourse.set(courseId, [alias]);
  }
  return byCourse;
}

/** The four lists above in one D1 round trip, courses with their short names. */
export async function getTaxonomy(db: Database): Promise<Taxonomy> {
  const [departments, courses, aliases, semesters, examTypes] = await db.batch([
    listDepartments(db),
    listCourses(db),
    listCourseAliases(db),
    listSemesters(db),
    listExamTypes(db),
  ]);
  const byCourse = aliasesByCourse(aliases);
  return {
    departments,
    courses: courses.map((c) => ({ ...c, aliases: byCourse.get(c.id) ?? [] })),
    semesters,
    examTypes,
  };
}
