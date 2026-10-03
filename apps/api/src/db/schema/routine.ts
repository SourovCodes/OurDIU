import {
  ROUTINE_DAYS,
  ROUTINE_DEPARTMENTS,
  ROUTINE_VERSION_STATUSES,
  type RoutineFile,
  type RoutineWarning,
} from "@ourdiu/shared";
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { timestamps } from "./columns";

// The Class Routine (docs/PLAN.md, Phase 3). Each department's routine comes in
// versions, uploaded as JSON files (`RoutineFile`) and kept as drafts until an admin
// makes one live. Students only ever see the live version.

export const routineVersions = sqliteTable(
  "routine_versions",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    department: text({ enum: ROUTINE_DEPARTMENTS }).notNull(),
    /** As printed on DIU's PDF: "4.1". */
    version: text().notNull(),
    publishedOn: text(),
    source: text(),
    status: text({ enum: ROUTINE_VERSION_STATUSES }).notNull().default("draft"),
    /** The uploaded file, kept as it was: `routine/versions/<uuid>.json` in R2. */
    fileKey: text().notNull(),
    slots: text({ mode: "json" }).$type<RoutineFile["slots"]>().notNull(),
    /** The file's course titles and teachers' names; copied to the lists below when made live. */
    courses: text({ mode: "json" })
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'`),
    teachers: text({ mode: "json" })
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'`),
    warnings: text({ mode: "json" })
      .$type<RoutineWarning[]>()
      .notNull()
      .default(sql`'[]'`),
    sectionCount: integer().notNull(),
    classCount: integer().notNull(),
    /** Null once the uploader's account is deleted. */
    uploadedBy: text().references(() => user.id, { onDelete: "set null" }),
    liveAt: integer({ mode: "timestamp_ms" }),
    replacedAt: integer({ mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("routine_versions_department_version_idx").on(
      t.department,
      t.version,
    ),
    // One live version per department.
    uniqueIndex("routine_versions_live_idx")
      .on(t.department)
      .where(sql`${t.status} = 'live'`),
    index("routine_versions_uploaded_by_idx").on(t.uploadedBy),
  ],
);

export type RoutineVersionRow = typeof routineVersions.$inferSelect;

/** A class in a version's week. Removed with the version. */
export const routineClasses = sqliteTable(
  "routine_classes",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    versionId: integer()
      .notNull()
      .references(() => routineVersions.id, { onDelete: "cascade" }),
    day: text({ enum: ROUTINE_DAYS }).notNull(),
    /** Minutes since midnight. */
    start: integer().notNull(),
    end: integer().notNull(),
    course: text().notNull(),
    section: text().notNull(),
    labGroup: text(),
    room: text().notNull(),
    roomType: text({ enum: ["lab"] }),
    teacher: text(),
  },
  (t) => [
    index("routine_classes_version_id_section_idx").on(t.versionId, t.section),
  ],
);

export type RoutineClassRow = typeof routineClasses.$inferSelect;
export type NewRoutineClassRow = typeof routineClasses.$inferInsert;

/**
 * Course titles, kept across versions: a version without a title for a code shows
 * the one an earlier version had. Written when a version is made live.
 */
export const routineCourses = sqliteTable("routine_courses", {
  code: text().primaryKey(),
  title: text().notNull(),
  updatedAt: timestamps.updatedAt,
});

/** Teachers' names by initials, kept across versions like course titles. */
export const routineTeachers = sqliteTable("routine_teachers", {
  initials: text().primaryKey(),
  name: text().notNull(),
  updatedAt: timestamps.updatedAt,
});
