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
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { timestamps } from "./columns";

// The Class Routine (docs/PLAN.md, Phase 3). Each department's routine comes in
// versions, read from DIU's PDF and kept as drafts until an admin makes one live.
// Students only ever see the live version.

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
    /** DIU's PDF it was read from: `routine/versions/<uuid>.pdf` in R2. */
    fileKey: text().notNull(),
    slots: text({ mode: "json" }).$type<RoutineFile["slots"]>().notNull(),
    /** The teachers the PDF lists (EEE's does); added to the list below when made live. */
    teachers: text({ mode: "json" })
      .$type<NonNullable<RoutineFile["teachers"]>>()
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

/** A department's course titles by code, kept across versions; added by admins. */
export const routineCourses = sqliteTable(
  "routine_courses",
  {
    department: text({ enum: ROUTINE_DEPARTMENTS }).notNull(),
    code: text().notNull(),
    title: text().notNull(),
    updatedAt: timestamps.updatedAt,
  },
  (t) => [primaryKey({ columns: [t.department, t.code] })],
);

/**
 * A department's teachers by initials, kept across versions like course titles:
 * their names, and how students reach them. Admins edit them; a PDF that lists
 * teachers adds the ones missing and fills in what's empty, never overwriting.
 * Departments' initials overlap: EEE's "SD" isn't CSE's.
 */
export const routineTeachers = sqliteTable(
  "routine_teachers",
  {
    department: text({ enum: ROUTINE_DEPARTMENTS }).notNull(),
    initials: text().notNull(),
    name: text().notNull(),
    phone: text(),
    email: text(),
    /** Where the teacher sits: "KT-712". */
    room: text(),
    updatedAt: timestamps.updatedAt,
  },
  (t) => [primaryKey({ columns: [t.department, t.initials] })],
);
