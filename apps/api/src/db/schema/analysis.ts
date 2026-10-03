import { ANALYSIS_STATUSES } from "@ourdiu/shared";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { timestamps } from "./columns";
import { submissions } from "./questions";
import { courses, departments, examTypes, semesters } from "./taxonomy";

/**
 * The AI analysis of a submission's PDF: compressed, then read by Gemini. One row per
 * submission, overwritten when an admin re-runs it. The queue message carries
 * `run_id`, so a message from an earlier run is ignored.
 *
 * Extracted names are stored in their standard spelling; the `*_id` columns hold the
 * matching catalog entry, null when the value is new or wasn't found (and
 * becomes null if that entry is deleted).
 */
export const submissionAnalyses = sqliteTable(
  "submission_analyses",
  {
    submissionId: integer()
      .primaryKey()
      .references(() => submissions.id, { onDelete: "cascade" }),
    runId: text().notNull(),
    /**
     * Whether a passing result publishes the paper. Only the check that runs right
     * after upload does; re-runs by an admin never publish.
     */
    autoPublish: integer({ mode: "boolean" }).notNull().default(false),
    status: text({ enum: ANALYSIS_STATUSES }).notNull().default("queued"),
    error: text(),
    /** Delivery attempt of the current run. */
    attempts: integer().notNull().default(0),
    model: text(),
    originalBytes: integer(),
    sentBytes: integer(),

    isQuestionPaper: integer({ mode: "boolean" }),
    paperCount: integer(),
    note: text(),

    departmentId: integer().references(() => departments.id, {
      onDelete: "set null",
    }),
    departmentName: text(),
    departmentShortName: text(),
    courseId: integer().references(() => courses.id, { onDelete: "set null" }),
    courseName: text(),
    semesterId: integer().references(() => semesters.id, {
      onDelete: "set null",
    }),
    semesterName: text(),
    examTypeId: integer().references(() => examTypes.id, {
      onDelete: "set null",
    }),
    examTypeName: text(),
    section: text(),
    batch: text(),

    /** Gemini's JSON reply, for debugging. */
    rawResponse: text(),
    completedAt: integer({ mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => [index("submission_analyses_status_idx").on(t.status)],
);

export type SubmissionAnalysisRow = typeof submissionAnalyses.$inferSelect;

/**
 * The text of a paper, read off its PDF by the AI: shown under a published paper and
 * searched (`submission_texts_fts`, an FTS5 index kept in sync by triggers, migration
 * 0014). Written by the upload check and by the admin backfill for older papers; a
 * row exists once a read was tried, with `error` set if it failed. Only published
 * papers' text is ever served.
 */
export const submissionTexts = sqliteTable("submission_texts", {
  submissionId: integer()
    .primaryKey()
    .references(() => submissions.id, { onDelete: "cascade" }),
  /** Null if the read failed. */
  text: text(),
  error: text(),
  model: text(),
  ...timestamps,
});

export type SubmissionTextRow = typeof submissionTexts.$inferSelect;
