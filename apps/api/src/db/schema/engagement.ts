import { REPORT_REASONS, REPORT_STATUSES } from "@ourdiu/shared";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { timestamps } from "./columns";
import { submissions } from "./questions";

/**
 * One like (1) or dislike (-1) per user per submission. Triggers keep
 * submissions.like_count / dislike_count in sync on insert, update and delete.
 */
export const submissionVotes = sqliteTable(
  "submission_votes",
  {
    submissionId: integer()
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    value: integer().notNull(),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.submissionId, t.userId] }),
    check("submission_votes_value_check", sql`${t.value} in (1, -1)`),
    index("submission_votes_user_id_idx").on(t.userId),
  ],
);

/**
 * A user's report that something is wrong with a published submission, reviewed by an
 * admin. Triggers keep submissions.pending_report_count in sync and hide a published
 * submission (back to pending review) once it reaches REPORT_HIDE_THRESHOLD.
 */
export const submissionReports = sqliteTable(
  "submission_reports",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    submissionId: integer()
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    reporterId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reason: text({ enum: REPORT_REASONS }).notNull(),
    details: text(),
    status: text({ enum: REPORT_STATUSES }).notNull().default("pending"),
    ...timestamps,
  },
  (t) => [
    // One open report per user per submission, so one user can't hide a paper alone.
    uniqueIndex("submission_reports_open_unique")
      .on(t.submissionId, t.reporterId)
      .where(sql`status = 'pending'`),
    index("submission_reports_submission_id_status_idx").on(
      t.submissionId,
      t.status,
    ),
    index("submission_reports_reporter_id_idx").on(t.reporterId),
  ],
);

export type SubmissionVoteRow = typeof submissionVotes.$inferSelect;
export type SubmissionReportRow = typeof submissionReports.$inferSelect;
