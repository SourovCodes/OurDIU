import type {
  MySubmission,
  MySubmissionDetail,
  Profile,
  ReviewActivity,
  SubmissionFields,
} from "@ourdiu/shared";
import { canContribute } from "@ourdiu/shared/constants";
import { and, count, desc, eq, gt, inArray, ne, or, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { submissions, user } from "../db/schema";
import { AppError } from "../lib/errors";
import {
  enqueueAnalysis,
  getSubmissionAnalysis,
  publishIfConfirmed,
  type AnalysisJob,
} from "./analysis";
import { submissionStatusOrder } from "./common";
import {
  addReviewMessage,
  changesWereRequested,
  listReviewMessages,
  markReviewRead,
} from "./review";
import { selectSubmissionRows, toMySubmission } from "./submission-rows";
import {
  assertIsPdf,
  classificationColumns,
  newSubmissionFileKey,
  preferExistingValues,
  resolveQuestionId,
} from "./submissions";
import { submissionFileKeys, type WatermarkJob } from "./watermark";

/** The signed-in user's profile and the counts kept on their row. */
export async function getProfile(
  db: Database,
  userId: string,
): Promise<Profile> {
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      username: user.username,
      image: user.image,
      publishedCount: user.publishedSubmissionCount,
      viewCount: user.publishedViewCount,
    })
    .from(user)
    .where(eq(user.id, userId));
  if (!row) throw new AppError(404, "NOT_FOUND", "User not found");
  const { role, ...profile } = row;
  return {
    ...profile,
    // Every user gets one at sign-up; the column is only nullable for SQLite's sake.
    username: row.username ?? "",
    canContribute: canContribute({ email: row.email, role }),
  };
}

/**
 * The user's own submissions in every status: those waiting for their changes first,
 * then published, pending review and rejected; newest first within each.
 */
export async function listOwnSubmissions(
  db: Database,
  uploaderId: string,
): Promise<MySubmission[]> {
  const rows = await selectSubmissionRows(db)
    .where(eq(submissions.uploaderId, uploaderId))
    .orderBy(
      sql`${submissions.status} <> 'changes_requested'`,
      submissionStatusOrder,
      desc(submissions.createdAt),
    );
  return rows.map(toMySubmission);
}

/** How many of the user's papers need them: changes asked for, or unread messages. */
export async function getReviewActivity(
  db: Database,
  uploaderId: string,
): Promise<ReviewActivity> {
  const [row] = await db
    .select({ needsAttention: count() })
    .from(submissions)
    .where(
      and(
        eq(submissions.uploaderId, uploaderId),
        or(
          eq(submissions.status, "changes_requested"),
          gt(submissions.uploaderUnread, 0),
        ),
      ),
    );
  return { needsAttention: row?.needsAttention ?? 0 };
}

/**
 * One of the user's own submissions, with what the AI check found and the review
 * conversation. Marks the conversation read; `unread` still says how many entries
 * were new.
 */
export async function getOwnSubmission(
  db: Database,
  uploaderId: string,
  id: number,
  { markRead = true }: { markRead?: boolean } = {},
): Promise<MySubmissionDetail | null> {
  const [row] = await selectSubmissionRows(db)
    .where(and(eq(submissions.id, id), eq(submissions.uploaderId, uploaderId)))
    .limit(1);
  if (!row) return null;
  const [analysis, messages] = await Promise.all([
    getSubmissionAnalysis(db, id),
    listReviewMessages(db, id, "uploader"),
  ]);
  if (markRead && row.uploaderUnread > 0) {
    await markReviewRead(db, id, "uploader");
  }
  return {
    ...toMySubmission(row),
    // Only the verdict and the values: errors and costs are for admins.
    analysisDetail: analysis && {
      status: analysis.status,
      requestedAt: analysis.requestedAt,
      completedAt: analysis.completedAt,
      isQuestionPaper: analysis.isQuestionPaper,
      paperCount: analysis.paperCount,
      note: analysis.note,
      flag: analysis.flag,
      values: analysis.values,
    },
    messages,
  };
}

function findOwnSubmission(db: Database, uploaderId: string, id: number) {
  return db.query.submissions.findFirst({
    columns: {
      fileKey: true,
      watermarkedFileKey: true,
      status: true,
    },
    where: and(eq(submissions.id, id), eq(submissions.uploaderId, uploaderId)),
  });
}

/** The PDF of one of the user's own submissions, whatever its status. */
export async function getOwnSubmissionFile(
  db: Database,
  bucket: R2Bucket,
  uploaderId: string,
  id: number,
) {
  const submission = await findOwnSubmission(db, uploaderId, id);
  if (!submission) return null;
  return bucket.get(submission.fileKey);
}

/**
 * Deletes one of the user's own submissions and its PDF. Published papers are part of
 * the public bank, so only pending and rejected submissions can be withdrawn.
 */
export async function withdrawSubmission(
  db: Database,
  bucket: R2Bucket,
  uploaderId: string,
  id: number,
) {
  const submission = await findOwnSubmission(db, uploaderId, id);
  if (!submission) {
    throw new AppError(404, "NOT_FOUND", "Submission not found");
  }
  if (submission.status === "published") {
    throw new AppError(
      409,
      "CONFLICT",
      "Published papers can't be withdrawn. Contact an admin to remove one.",
    );
  }

  // The status condition guards against the paper being published in the meantime.
  const deleted = await db
    .delete(submissions)
    .where(
      and(
        eq(submissions.id, id),
        eq(submissions.uploaderId, uploaderId),
        ne(submissions.status, "published"),
      ),
    )
    .returning({ id: submissions.id });
  if (deleted.length === 0) {
    throw new AppError(
      409,
      "CONFLICT",
      "This submission was just published and can no longer be withdrawn.",
    );
  }
  // A paper hidden by reports may have been published, with a watermarked copy.
  await bucket.delete(submissionFileKeys(submission));
}

/** The statuses in which the uploader can still change their paper. */
const EDITABLE_STATUSES = ["pending_review", "changes_requested"] as const;

async function requireEditableOwnSubmission(
  db: Database,
  uploaderId: string,
  id: number,
) {
  const submission = await findOwnSubmission(db, uploaderId, id);
  if (!submission) {
    throw new AppError(404, "NOT_FOUND", "Submission not found");
  }
  if (!(EDITABLE_STATUSES as readonly string[]).includes(submission.status)) {
    throw new AppError(
      409,
      "CONFLICT",
      "Only papers waiting for review or for your changes can be changed.",
    );
  }
  return submission;
}

/** Guards an update on the paper still being editable. */
const editable = (id: number) =>
  and(eq(submissions.id, id), inArray(submissions.status, EDITABLE_STATUSES));

/**
 * Lets the uploader correct the details of a paper waiting for review or for their
 * changes, the same way they were given on upload. Then compares them with the AI's
 * earlier reading (no new AI call) and publishes the paper if they now match, unless
 * an admin asked for changes to it: then it waits for the admin.
 */
export async function reclassifyOwnSubmission(
  db: Database,
  watermarkQueue: Queue<WatermarkJob>,
  uploaderId: string,
  id: number,
  input: SubmissionFields,
): Promise<MySubmissionDetail> {
  await requireEditableOwnSubmission(db, uploaderId, id);

  const fields = await preferExistingValues(db, input);
  const questionId = await resolveQuestionId(db, fields);
  await db
    .update(submissions)
    .set({
      ...classificationColumns(fields, questionId),
      section: fields.section ?? null,
      batch: fields.batch ?? null,
    })
    .where(editable(id));

  if (await changesWereRequested(db, id)) {
    // Part of answering the reviewer: they see it in the conversation.
    await addReviewMessage(db, {
      submissionId: id,
      authorId: uploaderId,
      role: "uploader",
      kind: "details_edited",
    });
  } else {
    const analysis = await getSubmissionAnalysis(db, id);
    if (analysis?.status === "completed" && analysis.values) {
      await publishIfConfirmed(
        db,
        watermarkQueue,
        id,
        {
          isQuestionPaper: analysis.isQuestionPaper ?? false,
          paperCount: analysis.paperCount ?? 0,
        },
        analysis.values,
      );
    }
  }
  return (await getOwnSubmission(db, uploaderId, id, { markRead: false }))!;
}

/**
 * Replaces the PDF of a paper waiting for review or for the uploader's changes. The
 * AI check runs again on the new file, but doesn't publish it: an admin decides.
 */
export async function replaceOwnSubmissionFile(
  db: Database,
  bucket: R2Bucket,
  analysisQueue: Queue<AnalysisJob>,
  uploaderId: string,
  id: number,
  file: File,
): Promise<MySubmissionDetail> {
  const submission = await requireEditableOwnSubmission(db, uploaderId, id);
  await assertIsPdf(file);

  const fileKey = newSubmissionFileKey();
  await bucket.put(fileKey, file, {
    httpMetadata: { contentType: "application/pdf" },
  });
  const replaced = await db
    .update(submissions)
    .set({
      fileKey,
      fileSize: file.size,
      // A copy of the old file (left from when it was published) no longer fits.
      watermarkedFileKey: null,
      watermarkedFileSize: null,
      watermarkStatus: null,
      watermarkError: null,
    })
    .where(editable(id))
    .returning({ id: submissions.id });
  if (replaced.length === 0) {
    await bucket.delete(fileKey);
    throw new AppError(
      409,
      "CONFLICT",
      "This paper was just reviewed and can no longer be changed.",
    );
  }
  await bucket.delete(submissionFileKeys(submission));
  await addReviewMessage(db, {
    submissionId: id,
    authorId: uploaderId,
    role: "uploader",
    kind: "file_replaced",
  });
  await enqueueAnalysis(db, analysisQueue, id, { autoPublish: false });
  return (await getOwnSubmission(db, uploaderId, id, { markRead: false }))!;
}

/**
 * Sends a paper an admin asked to change back for review, with an optional note on
 * what changed.
 */
export async function resubmitOwnSubmission(
  db: Database,
  uploaderId: string,
  id: number,
  note: string | undefined,
): Promise<MySubmissionDetail> {
  const submission = await findOwnSubmission(db, uploaderId, id);
  if (!submission) {
    throw new AppError(404, "NOT_FOUND", "Submission not found");
  }
  const notWaiting = () =>
    new AppError(
      409,
      "CONFLICT",
      "Only papers a reviewer asked you to change can be resubmitted.",
    );
  if (submission.status !== "changes_requested") throw notWaiting();

  // Guarded by the status, in case an admin decided in the meantime.
  const updated = await db
    .update(submissions)
    .set({ status: "pending_review" })
    .where(
      and(eq(submissions.id, id), eq(submissions.status, "changes_requested")),
    )
    .returning({ id: submissions.id });
  if (updated.length === 0) throw notWaiting();
  await addReviewMessage(db, {
    submissionId: id,
    authorId: uploaderId,
    role: "uploader",
    kind: "resubmitted",
    body: note,
  });
  return (await getOwnSubmission(db, uploaderId, id, { markRead: false }))!;
}

/** The uploader writes to the reviewers of a paper that isn't published. */
export async function postOwnReviewMessage(
  db: Database,
  uploaderId: string,
  id: number,
  body: string,
): Promise<MySubmissionDetail> {
  const submission = await findOwnSubmission(db, uploaderId, id);
  if (!submission) {
    throw new AppError(404, "NOT_FOUND", "Submission not found");
  }
  if (submission.status === "published") {
    throw new AppError(
      409,
      "CONFLICT",
      "This paper is published. To point out a problem, report it.",
    );
  }
  await addReviewMessage(db, {
    submissionId: id,
    authorId: uploaderId,
    role: "uploader",
    kind: "comment",
    body,
  });
  return (await getOwnSubmission(db, uploaderId, id, { markRead: false }))!;
}

const usernameTaken = () =>
  new AppError(409, "USERNAME_TAKEN", "Someone already has that username");

/**
 * Changes a user's username (already validated and lowercased): their own, or any
 * user's for an admin.
 */
export async function updateUsername(
  db: Database,
  userId: string,
  username: string,
): Promise<string> {
  const [taken] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.username, username), ne(user.id, userId)));
  if (taken) throw usernameTaken();
  try {
    const updated = await db
      .update(user)
      .set({ username })
      .where(eq(user.id, userId))
      .returning({ id: user.id });
    if (updated.length === 0) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }
  } catch (err) {
    // Taken by someone else in the meantime: the unique index wins.
    if (String(err).includes("UNIQUE constraint failed")) throw usernameTaken();
    throw err;
  }
  return username;
}
