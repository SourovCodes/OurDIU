import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { timestamps } from "./columns";
import { submissions } from "./questions";

export const EMAIL_KINDS = [
  // To the uploader.
  "published",
  "rejected",
  "changes_requested",
  "admin_message",
  // To admins.
  "uploader_update",
  "report",
] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

/**
 * Emails waiting to be sent (services/email). Written where a review step happens,
 * sent and deleted by the cron (`sendQueuedEmails`), so a failed send never fails the
 * request. Rendered when sent: a recipient who turned emails off by then gets none.
 */
export const emailOutbox = sqliteTable(
  "email_outbox",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    recipientId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text({ enum: EMAIL_KINDS }).notNull(),
    submissionId: integer()
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    /** The reason, request or message the email quotes, if any. */
    body: text(),
    /** Failed sends so far; the email is dropped after the last. */
    attempts: integer().notNull().default(0),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("email_outbox_created_at_idx").on(t.createdAt)],
);

export type EmailOutboxRow = typeof emailOutbox.$inferSelect;
