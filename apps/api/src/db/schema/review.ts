import { REVIEW_AUTHOR_ROLES, REVIEW_MESSAGE_KINDS } from "@ourdiu/shared";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { timestamps } from "./columns";
import { submissions } from "./questions";

/**
 * A submission's review conversation between admins and its uploader: their messages,
 * and each step of the review (a decision, an edit, a resubmission) with its note.
 * Removed with the submission.
 */
export const submissionMessages = sqliteTable(
  "submission_messages",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    submissionId: integer()
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    /** Null once the author's account is deleted. */
    authorId: text().references(() => user.id, { onDelete: "set null" }),
    authorRole: text({ enum: REVIEW_AUTHOR_ROLES }).notNull(),
    kind: text({ enum: REVIEW_MESSAGE_KINDS }).notNull(),
    body: text(),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("submission_messages_submission_id_created_at_idx").on(
      t.submissionId,
      t.createdAt,
    ),
    index("submission_messages_author_id_idx").on(t.authorId),
  ],
);

export type SubmissionMessageRow = typeof submissionMessages.$inferSelect;
