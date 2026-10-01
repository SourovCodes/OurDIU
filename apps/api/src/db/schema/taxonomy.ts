import {
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

export const departments = sqliteTable("departments", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
  shortName: text().notNull().unique(),
  /**
   * Published papers in the department, kept in sync with questions.published_count
   * by a trigger (migration 0006); never write it from application code.
   */
  publishedCount: integer().notNull().default(0),
});

export const courses = sqliteTable(
  "courses",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    departmentId: integer()
      .notNull()
      .references(() => departments.id),
    /**
     * Published papers of the course, kept in sync with questions.published_count
     * by a trigger (migration 0009); never write it from application code.
     */
    publishedCount: integer().notNull().default(0),
  },
  (t) => [
    // Also serves as the index for looking up courses by department.
    unique("courses_department_id_name_unique").on(t.departmentId, t.name),
    // Referenced by the composite foreign key on `questions`, which guarantees a
    // question's department is the same as its course's department.
    unique("courses_id_department_id_unique").on(t.id, t.departmentId),
    // Covers the course list, which is ordered by name.
    index("courses_name_department_id_idx").on(t.name, t.departmentId),
  ],
);

export const semesters = sqliteTable("semesters", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
});

export const examTypes = sqliteTable("exam_types", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
});

export type DepartmentRow = typeof departments.$inferSelect;
export type CourseRow = typeof courses.$inferSelect;
export type SemesterRow = typeof semesters.$inferSelect;
export type ExamTypeRow = typeof examTypes.$inferSelect;
