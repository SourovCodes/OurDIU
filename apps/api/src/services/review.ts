import type {
  ReviewAuthorRole,
  ReviewMessage,
  ReviewMessageKind,
} from "@ourdiu/shared";
import { and, asc, eq, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { submissionMessages, submissions, user } from "../db/schema";

// A submission's review conversation (submission_messages). Every entry is written
// with the bump of the other side's unread count, in one batch. A step is recorded
// right after the guarded update that makes it.

export type NewReviewMessage = {
  submissionId: number;
  /** Null for steps no signed-in user took (tests, scripts). */
  authorId: string | null;
  role: ReviewAuthorRole;
  kind: ReviewMessageKind;
  body?: string | null;
};

/**
 * Adds an entry and counts it as unread for the other side: the uploader for an
 * admin's entry, admins for the uploader's.
 */
export async function addReviewMessage(
  db: Database,
  message: NewReviewMessage,
) {
  const unread =
    message.role === "admin"
      ? { uploaderUnread: sql`uploader_unread + 1` }
      : { adminUnread: sql`admin_unread + 1` };
  await db.batch([
    db.insert(submissionMessages).values({
      submissionId: message.submissionId,
      authorId: message.authorId,
      authorRole: message.role,
      kind: message.kind,
      body: message.body || null,
    }),
    db
      .update(submissions)
      // `updated_at` (the paper's last change) stays as it is.
      .set({ ...unread, updatedAt: sql`updated_at` })
      .where(eq(submissions.id, message.submissionId)),
  ]);
}

/**
 * The conversation, oldest first. Uploaders don't see which admin wrote: an admin's
 * name and picture are left out for them.
 */
export async function listReviewMessages(
  db: Database,
  submissionId: number,
  viewer: ReviewAuthorRole,
): Promise<ReviewMessage[]> {
  const rows = await db
    .select({
      id: submissionMessages.id,
      kind: submissionMessages.kind,
      body: submissionMessages.body,
      role: submissionMessages.authorRole,
      name: user.name,
      image: user.image,
      createdAt: submissionMessages.createdAt,
    })
    .from(submissionMessages)
    .leftJoin(user, eq(user.id, submissionMessages.authorId))
    .where(eq(submissionMessages.submissionId, submissionId))
    .orderBy(asc(submissionMessages.createdAt), asc(submissionMessages.id));
  return rows.map(({ role, name, image, createdAt, ...message }) => {
    const hidden = viewer === "uploader" && role === "admin";
    return {
      ...message,
      author: {
        role,
        name: hidden ? null : name,
        image: hidden ? null : image,
      },
      createdAt: createdAt.toISOString(),
    };
  });
}

/** Marks the conversation read for one side, once they open the paper. */
export async function markReviewRead(
  db: Database,
  submissionId: number,
  viewer: ReviewAuthorRole,
) {
  const unread = sql.raw(
    viewer === "admin" ? "admin_unread" : "uploader_unread",
  );
  // Raw SQL, so `updated_at` stays as it is.
  await db.run(
    sql`update submissions set ${unread} = 0 where id = ${submissionId} and ${unread} <> 0`,
  );
}

/**
 * Whether an admin has ever asked for changes to the paper. Such a paper isn't
 * published by the AI check: the admin wants to see it again.
 */
export async function changesWereRequested(
  db: Database,
  submissionId: number,
): Promise<boolean> {
  const row = await db.query.submissionMessages.findFirst({
    columns: { id: true },
    where: and(
      eq(submissionMessages.submissionId, submissionId),
      eq(submissionMessages.kind, "changes_requested"),
    ),
  });
  return row !== undefined;
}
