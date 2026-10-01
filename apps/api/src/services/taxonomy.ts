import type { Taxonomy } from "@ourdiu/shared";
import { asc, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { courses, departments, examTypes, semesters } from "../db/schema";
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

/** The four lists above in one D1 round trip. */
export async function getTaxonomy(db: Database): Promise<Taxonomy> {
  const [departments, courses, semesters, examTypes] = await db.batch([
    listDepartments(db),
    listCourses(db),
    listSemesters(db),
    listExamTypes(db),
  ]);
  return { departments, courses, semesters, examTypes };
}
