import type {
  MySubmission,
  MySubmissionDetail,
  Profile,
  SubmissionFields,
} from "@ourdiu/shared";
import { canContribute } from "@ourdiu/shared/constants";
import { and, desc, eq, ne } from "drizzle-orm";
import type { Database } from "../db/client";
import { submissions, user } from "../db/schema";
import { AppError } from "../lib/errors";
import { getSubmissionAnalysis, publishIfConfirmed } from "./analysis";
import { submissionStatusOrder } from "./common";
import { selectSubmissionRows, toMySubmission } from "./submission-rows";
import {
  classificationColumns,
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

/** The user's own submissions in every status: published first, then newest first. */
export async function listOwnSubmissions(
  db: Database,
  uploaderId: string,
): Promise<MySubmission[]> {
  const rows = await selectSubmissionRows(db)
    .where(eq(submissions.uploaderId, uploaderId))
    .orderBy(submissionStatusOrder, desc(submissions.createdAt));
  return rows.map(toMySubmission);
}

/** One of the user's own submissions, with what the AI check found. */
export async function getOwnSubmission(
  db: Database,
  uploaderId: string,
  id: number,
): Promise<MySubmissionDetail | null> {
  const [row] = await selectSubmissionRows(db)
    .where(and(eq(submissions.id, id), eq(submissions.uploaderId, uploaderId)))
    .limit(1);
  if (!row) return null;
  const analysis = await getSubmissionAnalysis(db, id);
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
  };
}

function findOwnSubmission(db: Database, uploaderId: string, id: number) {
  return db.query.submissions.findFirst({
    columns: { fileKey: true, watermarkedFileKey: true, status: true },
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

/**
 * Lets the uploader correct the details of a paper still pending review, the same way
 * they were given on upload. Then compares them with the AI's earlier reading (no new
 * AI call) and publishes the paper if they now match.
 */
export async function reclassifyOwnSubmission(
  db: Database,
  watermarkQueue: Queue<WatermarkJob>,
  uploaderId: string,
  id: number,
  input: SubmissionFields,
): Promise<MySubmissionDetail> {
  const submission = await findOwnSubmission(db, uploaderId, id);
  if (!submission) {
    throw new AppError(404, "NOT_FOUND", "Submission not found");
  }
  if (submission.status !== "pending_review") {
    throw new AppError(
      409,
      "CONFLICT",
      "Only papers waiting for review can be changed.",
    );
  }

  const fields = await preferExistingValues(db, input);
  const questionId = await resolveQuestionId(db, fields);
  await db
    .update(submissions)
    .set({
      ...classificationColumns(fields, questionId),
      section: fields.section ?? null,
      batch: fields.batch ?? null,
    })
    .where(
      and(eq(submissions.id, id), eq(submissions.status, "pending_review")),
    );

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
  return (await getOwnSubmission(db, uploaderId, id))!;
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
