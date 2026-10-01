import type {
  AdminCatalog,
  AdminCourse,
  AdminDepartment,
  AdminExamType,
  AdminSemester,
  CreateCourseInput,
  DepartmentInput,
} from "@ourdiu/shared";
import { asc, eq, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { courses, departments, examTypes, semesters } from "../db/schema";
import { isConstraintError } from "../lib/db-errors";
import { AppError } from "../lib/errors";

/**
 * Correlated count of `table` rows whose `column` references the outer `parent` row.
 * Written out with qualified names: Drizzle leaves columns unqualified in a
 * single-table select, which would resolve `id` inside the subquery.
 */
const countWhere = (table: string, column: string, parent: string) =>
  sql
    .raw(
      `(select count(*) from "${table}" where "${table}"."${column}" = "${parent}"."id")`,
    )
    .mapWith(Number);
import { semesterRecency } from "./common";

function selectDepartments(db: Database) {
  return db
    .select({
      id: departments.id,
      name: departments.name,
      shortName: departments.shortName,
      courseCount: countWhere("courses", "department_id", "departments"),
      questionCount: countWhere("questions", "department_id", "departments"),
      submissionCount: countWhere(
        "submissions",
        "department_id",
        "departments",
      ),
    })
    .from(departments)
    .$dynamic();
}

function selectCourses(db: Database) {
  return db
    .select({
      id: courses.id,
      name: courses.name,
      departmentId: courses.departmentId,
      questionCount: countWhere("questions", "course_id", "courses"),
      submissionCount: countWhere("submissions", "course_id", "courses"),
    })
    .from(courses)
    .$dynamic();
}

function selectSemesters(db: Database) {
  return db
    .select({
      id: semesters.id,
      name: semesters.name,
      questionCount: countWhere("questions", "semester_id", "semesters"),
      submissionCount: countWhere("submissions", "semester_id", "semesters"),
    })
    .from(semesters)
    .$dynamic();
}

function selectExamTypes(db: Database) {
  return db
    .select({
      id: examTypes.id,
      name: examTypes.name,
      questionCount: countWhere("questions", "exam_type_id", "exam_types"),
      submissionCount: countWhere("submissions", "exam_type_id", "exam_types"),
    })
    .from(examTypes)
    .$dynamic();
}

/** Every catalog entry with how often it is used. Same order as the public lists. */
export async function getCatalog(db: Database): Promise<AdminCatalog> {
  const [departmentRows, courseRows, semesterRows, examTypeRows] =
    await Promise.all([
      selectDepartments(db).orderBy(asc(departments.name)),
      selectCourses(db).orderBy(asc(courses.name)),
      selectSemesters(db).orderBy(...semesterRecency),
      selectExamTypes(db).orderBy(asc(examTypes.name)),
    ]);
  return {
    departments: departmentRows,
    courses: courseRows,
    semesters: semesterRows,
    examTypes: examTypeRows,
  };
}

const notFound = (what: string) =>
  new AppError(404, "NOT_FOUND", `${what} not found`);

/** Runs a write, turning unique violations into a 409 with a readable message. */
async function uniquely<T>(message: string, write: () => Promise<T>) {
  try {
    return await write();
  } catch (err) {
    if (isConstraintError(err, "UNIQUE")) {
      throw new AppError(409, "CONFLICT", message);
    }
    throw err;
  }
}

/** Refuses to delete an entry that questions or submissions still use. */
function assertUnused(
  what: string,
  usage: {
    questionCount: number;
    submissionCount: number;
    courseCount?: number;
  },
) {
  const counted = (n: number | undefined, noun: string) =>
    n ? `${n} ${noun}${n === 1 ? "" : "s"}` : null;
  const uses = [
    counted(usage.courseCount, "course"),
    counted(usage.questionCount, "question"),
    counted(usage.submissionCount, "submission"),
  ].filter(Boolean);
  if (uses.length > 0) {
    throw new AppError(
      409,
      "IN_USE",
      `This ${what} is used by ${uses.join(", ")} and can't be deleted.`,
    );
  }
}

// ── Departments ──────────────────────────────────────────────────────────────

async function findDepartment(db: Database, id: number) {
  const [row] = await selectDepartments(db)
    .where(eq(departments.id, id))
    .limit(1);
  if (!row) throw notFound("Department");
  return row;
}

const departmentConflict =
  "A department with this name or short name already exists";

export async function createDepartment(
  db: Database,
  input: DepartmentInput,
): Promise<AdminDepartment> {
  const [row] = await uniquely(departmentConflict, () =>
    db.insert(departments).values(input).returning({ id: departments.id }),
  );
  return findDepartment(db, row!.id);
}

export async function updateDepartment(
  db: Database,
  id: number,
  input: DepartmentInput,
): Promise<AdminDepartment> {
  await findDepartment(db, id);
  await uniquely(departmentConflict, () =>
    db.update(departments).set(input).where(eq(departments.id, id)),
  );
  return findDepartment(db, id);
}

export async function deleteDepartment(db: Database, id: number) {
  assertUnused("department", await findDepartment(db, id));
  await db.delete(departments).where(eq(departments.id, id));
}

// ── Courses ──────────────────────────────────────────────────────────────────

async function findCourse(db: Database, id: number) {
  const [row] = await selectCourses(db).where(eq(courses.id, id)).limit(1);
  if (!row) throw notFound("Course");
  return row;
}

const courseConflict = "This department already has a course with this name";

export async function createCourse(
  db: Database,
  input: CreateCourseInput,
): Promise<AdminCourse> {
  const department = await db.query.departments.findFirst({
    columns: { id: true },
    where: eq(departments.id, input.departmentId),
  });
  if (!department) {
    throw new AppError(422, "VALIDATION_ERROR", "Request validation failed", [
      { path: ["department_id"], message: "Department not found" },
    ]);
  }
  const [row] = await uniquely(courseConflict, () =>
    db.insert(courses).values(input).returning({ id: courses.id }),
  );
  return findCourse(db, row!.id);
}

/** Only the name can change: questions depend on a course's department. */
export async function renameCourse(
  db: Database,
  id: number,
  name: string,
): Promise<AdminCourse> {
  await findCourse(db, id);
  await uniquely(courseConflict, () =>
    db.update(courses).set({ name }).where(eq(courses.id, id)),
  );
  return findCourse(db, id);
}

export async function deleteCourse(db: Database, id: number) {
  assertUnused("course", await findCourse(db, id));
  await db.delete(courses).where(eq(courses.id, id));
}

// ── Semesters ────────────────────────────────────────────────────────────────

async function findSemester(db: Database, id: number) {
  const [row] = await selectSemesters(db).where(eq(semesters.id, id)).limit(1);
  if (!row) throw notFound("Semester");
  return row;
}

const semesterConflict = "A semester with this name already exists";

export async function createSemester(
  db: Database,
  name: string,
): Promise<AdminSemester> {
  const [row] = await uniquely(semesterConflict, () =>
    db.insert(semesters).values({ name }).returning({ id: semesters.id }),
  );
  return findSemester(db, row!.id);
}

export async function renameSemester(
  db: Database,
  id: number,
  name: string,
): Promise<AdminSemester> {
  await findSemester(db, id);
  await uniquely(semesterConflict, () =>
    db.update(semesters).set({ name }).where(eq(semesters.id, id)),
  );
  return findSemester(db, id);
}

export async function deleteSemester(db: Database, id: number) {
  assertUnused("semester", await findSemester(db, id));
  await db.delete(semesters).where(eq(semesters.id, id));
}

// ── Exam types ───────────────────────────────────────────────────────────────

async function findExamType(db: Database, id: number) {
  const [row] = await selectExamTypes(db).where(eq(examTypes.id, id)).limit(1);
  if (!row) throw notFound("Exam type");
  return row;
}

const examTypeConflict = "An exam type with this name already exists";

export async function createExamType(
  db: Database,
  name: string,
): Promise<AdminExamType> {
  const [row] = await uniquely(examTypeConflict, () =>
    db.insert(examTypes).values({ name }).returning({ id: examTypes.id }),
  );
  return findExamType(db, row!.id);
}

export async function renameExamType(
  db: Database,
  id: number,
  name: string,
): Promise<AdminExamType> {
  await findExamType(db, id);
  await uniquely(examTypeConflict, () =>
    db.update(examTypes).set({ name }).where(eq(examTypes.id, id)),
  );
  return findExamType(db, id);
}

export async function deleteExamType(db: Database, id: number) {
  assertUnused("exam type", await findExamType(db, id));
  await db.delete(examTypes).where(eq(examTypes.id, id));
}
