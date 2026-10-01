import type {
  CreatedReport,
  CreateReportInput,
  QuestionInteractions,
  VoteResult,
  VoteValue,
} from "@ourdiu/shared";
import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { submissionReports, submissions, submissionVotes } from "../db/schema";
import { isSaved } from "./saved";
import { AppError } from "../lib/errors";

// View counters are bumped with plain SQL: an ORM update would also touch `updated_at`,
// which should only change when the row's content changes.

/** Counts a question page view. Returns false when the question doesn't exist. */
export async function recordQuestionView(db: Database, questionId: number) {
  const result = await db.run(
    sql`update questions set view_count = view_count + 1 where id = ${questionId}`,
  );
  return result.meta.changes > 0;
}

/** Counts a view of a published paper. Returns false for unknown or unpublished ones. */
export async function recordSubmissionView(db: Database, submissionId: number) {
  const result = await db.run(
    sql`update submissions set view_count = view_count + 1 where id = ${submissionId} and status = 'published'`,
  );
  return result.meta.changes > 0;
}

/** The question of a published paper, or null for unknown or unpublished ones. */
export async function publishedSubmissionQuestionId(
  db: Database,
  submissionId: number,
) {
  const submission = await db.query.submissions.findFirst({
    columns: { questionId: true, status: true },
    where: eq(submissions.id, submissionId),
  });
  return submission?.status === "published" ? submission.questionId : null;
}

/** Loads a published submission that `userId` may vote on or report. */
async function findPublishedSubmission(
  db: Database,
  submissionId: number,
  userId: string,
  action: "vote on" | "report",
) {
  const submission = await db.query.submissions.findFirst({
    columns: { status: true, uploaderId: true },
    where: eq(submissions.id, submissionId),
  });
  if (!submission || submission.status !== "published") {
    throw new AppError(404, "NOT_FOUND", "Submission not found");
  }
  if (submission.uploaderId === userId) {
    throw new AppError(403, "FORBIDDEN", `You can't ${action} your own paper`);
  }
}

async function voteResult(
  db: Database,
  submissionId: number,
  userId: string,
): Promise<VoteResult> {
  const [row] = await db
    .select({
      likeCount: submissions.likeCount,
      dislikeCount: submissions.dislikeCount,
      viewCount: submissions.viewCount,
      myVote: submissionVotes.value,
    })
    .from(submissions)
    .leftJoin(
      submissionVotes,
      and(
        eq(submissionVotes.submissionId, submissions.id),
        eq(submissionVotes.userId, userId),
      ),
    )
    .where(eq(submissions.id, submissionId));
  return { ...row!, myVote: (row!.myVote ?? null) as VoteValue | null };
}

/** Likes (1) or dislikes (-1) a paper, replacing the user's previous vote. */
export async function castVote(
  db: Database,
  submissionId: number,
  userId: string,
  value: VoteValue,
) {
  await findPublishedSubmission(db, submissionId, userId, "vote on");
  // The vote triggers update the counters on `submissions`.
  await db
    .insert(submissionVotes)
    .values({ submissionId, userId, value })
    .onConflictDoUpdate({
      target: [submissionVotes.submissionId, submissionVotes.userId],
      set: { value, updatedAt: new Date() },
    });
  return voteResult(db, submissionId, userId);
}

export async function removeVote(
  db: Database,
  submissionId: number,
  userId: string,
) {
  await findPublishedSubmission(db, submissionId, userId, "vote on");
  await db
    .delete(submissionVotes)
    .where(
      and(
        eq(submissionVotes.submissionId, submissionId),
        eq(submissionVotes.userId, userId),
      ),
    );
  return voteResult(db, submissionId, userId);
}

const alreadyReported = () =>
  new AppError(409, "ALREADY_REPORTED", "You've already reported this paper");

/**
 * Files a report for admin review. The report trigger hides the paper (back to pending
 * review) once enough different users have open reports on it.
 */
export async function reportSubmission(
  db: Database,
  submissionId: number,
  reporterId: string,
  input: CreateReportInput,
): Promise<CreatedReport> {
  await findPublishedSubmission(db, submissionId, reporterId, "report");

  const open = await db.query.submissionReports.findFirst({
    columns: { id: true },
    where: and(
      eq(submissionReports.submissionId, submissionId),
      eq(submissionReports.reporterId, reporterId),
      eq(submissionReports.status, "pending"),
    ),
  });
  if (open) throw alreadyReported();

  let report: { id: number; status: CreatedReport["status"] };
  try {
    [report] = (await db
      .insert(submissionReports)
      .values({
        submissionId,
        reporterId,
        reason: input.reason,
        details: input.details || null,
      })
      .returning({
        id: submissionReports.id,
        status: submissionReports.status,
      })) as [typeof report];
  } catch (err) {
    // Two reports from the same user at once: the partial unique index wins.
    if (String(err).includes("UNIQUE constraint failed")) {
      throw alreadyReported();
    }
    throw err;
  }

  const after = await db.query.submissions.findFirst({
    columns: { status: true },
    where: eq(submissions.id, submissionId),
  });
  return { ...report, submissionHidden: after?.status !== "published" };
}

/** The user's votes and open reports on a question's papers, and whether they saved it. */
export async function getQuestionInteractions(
  db: Database,
  questionId: number,
  userId: string,
): Promise<QuestionInteractions> {
  const [votes, reports, saved] = await Promise.all([
    db
      .select({
        submissionId: submissionVotes.submissionId,
        value: submissionVotes.value,
      })
      .from(submissionVotes)
      .innerJoin(submissions, eq(submissions.id, submissionVotes.submissionId))
      .where(
        and(
          eq(submissions.questionId, questionId),
          eq(submissionVotes.userId, userId),
        ),
      ),
    db
      .select({ submissionId: submissionReports.submissionId })
      .from(submissionReports)
      .innerJoin(
        submissions,
        eq(submissions.id, submissionReports.submissionId),
      )
      .where(
        and(
          eq(submissions.questionId, questionId),
          eq(submissionReports.reporterId, userId),
          eq(submissionReports.status, "pending"),
        ),
      ),
    isSaved(db, userId, questionId),
  ]);

  return {
    userId,
    votes: votes.map((vote) => ({
      submissionId: vote.submissionId,
      value: vote.value as VoteValue,
    })),
    reportedSubmissionIds: reports.map((report) => report.submissionId),
    saved,
  };
}
