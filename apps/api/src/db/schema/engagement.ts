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
import { questions, submissions } from "./questions";

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

/**
 * Questions a user saved (bookmarked) to come back to, on the website or in the app.
 * Removed with the user or the question.
 */
export const savedQuestions = sqliteTable(
  "saved_questions",
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    questionId: integer()
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.questionId] }),
    index("saved_questions_user_id_created_at_idx").on(t.userId, t.createdAt),
    index("saved_questions_question_id_idx").on(t.questionId),
  ],
);

/**
 * Question page views per hour (`hour` = Unix time / 3600), for "Most viewed today".
 * Bumped with the all-time counter by `recordQuestionView`; buckets older than the
 * window are pruned by `refreshTrending` (services/trending.ts).
 */
export const questionViewHours = sqliteTable(
  "question_view_hours",
  {
    questionId: integer()
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    hour: integer().notNull(),
    views: integer().notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.questionId, t.hour] }),
    index("question_view_hours_hour_idx").on(t.hour),
  ],
);

/**
 * The most viewed questions of the last 24 hours with their views then, rebuilt every
 * few minutes by the cron (`refreshTrending`) from `question_view_hours`, so lists
 * read a few rows instead of summing the window. Never written by anything else.
 */
export const trendingQuestions = sqliteTable(
  "trending_questions",
  {
    questionId: integer()
      .primaryKey()
      .references(() => questions.id, { onDelete: "cascade" }),
    views: integer().notNull(),
  },
  (t) => [index("trending_questions_views_idx").on(t.views)],
);

export type SubmissionVoteRow = typeof submissionVotes.$inferSelect;
export type SubmissionReportRow = typeof submissionReports.$inferSelect;
