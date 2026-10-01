import type {
  AdminReport,
  AdminReportList,
  AdminSubmission,
  AdminSubmissionDetail,
  ClassifySubmissionInput,
  ListAdminReportsQuery,
  ListAdminSubmissionsQuery,
  AdminSubmissionList,
  ReportStatus,
  SubmissionFields,
  SubmissionStatus,
} from "@ourdiu/shared";
import { and, count, desc, eq, type SQL } from "drizzle-orm";
import type { Database } from "../db/client";
import { usernameOf } from "../db/username";
import { inList } from "../db/in-list";
import {
  courses,
  departments,
  semesters,
  submissionReports,
  submissions,
  user,
} from "../db/schema";
import { isConstraintError } from "../lib/db-errors";
import { AppError } from "../lib/errors";
import { getSubmissionAnalysis } from "./analysis";
import {
  submissionFileKeys,
  watermarkIfMissing,
  type WatermarkJob,
} from "./watermark";
import {
  analysisDiffers,
  analysisFlagged,
  countSubmissionRows,
  selectSubmissionRows,
  toAdminSubmission,
  toClassification,
} from "./submission-rows";
import { preferExistingValues, resolveQuestionId } from "./submissions";

const notFound = () => new AppError(404, "NOT_FOUND", "Submission not found");

// ── Submissions ──────────────────────────────────────────────────────────────

async function submissionCountsByStatus(db: Database) {
  const rows = await db
    .select({ status: submissions.status, total: count() })
    .from(submissions)
    .groupBy(submissions.status);
  const total = (status: SubmissionStatus) =>
    rows.find((row) => row.status === status)?.total ?? 0;
  return {
    published: total("published"),
    pendingReview: total("pending_review"),
    rejected: total("rejected"),
  };
}

/** Every submission in any status: the most reported first, then newest first. */
export async function listAdminSubmissions(
  db: Database,
  query: ListAdminSubmissionsQuery,
): Promise<AdminSubmissionList> {
  const where = and(
    query.status ? eq(submissions.status, query.status) : undefined,
    query.ai === "flagged" ? analysisFlagged : undefined,
    query.ai === "differs" ? analysisDiffers : undefined,
  );
  const [rows, total, counts] = await Promise.all([
    selectSubmissionRows(db)
      .where(where)
      .orderBy(
        desc(submissions.pendingReportCount),
        desc(submissions.createdAt),
      )
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    countSubmissionRows(db, where),
    submissionCountsByStatus(db),
  ]);

  return {
    items: rows.map(toAdminSubmission),
    page: query.page,
    pageSize: query.pageSize,
    total,
    counts,
  };
}

async function findAdminSubmission(
  db: Database,
  id: number,
): Promise<AdminSubmission | null> {
  const [row] = await selectSubmissionRows(db)
    .where(eq(submissions.id, id))
    .limit(1);
  return row ? toAdminSubmission(row) : null;
}

async function requireAdminSubmission(db: Database, id: number) {
  const submission = await findAdminSubmission(db, id);
  if (!submission) throw notFound();
  return submission;
}

const reporterColumns = {
  id: user.id,
  username: usernameOf,
  name: user.name,
  email: user.email,
  image: user.image,
};

export async function getAdminSubmission(
  db: Database,
  id: number,
): Promise<AdminSubmissionDetail | null> {
  const submission = await findAdminSubmission(db, id);
  if (!submission) return null;

  const [reports, analysisDetail] = await Promise.all([
    db
      .select({
        id: submissionReports.id,
        reason: submissionReports.reason,
        details: submissionReports.details,
        status: submissionReports.status,
        createdAt: submissionReports.createdAt,
        reporter: reporterColumns,
      })
      .from(submissionReports)
      .innerJoin(user, eq(user.id, submissionReports.reporterId))
      .where(eq(submissionReports.submissionId, id))
      .orderBy(desc(submissionReports.createdAt), desc(submissionReports.id)),
    getSubmissionAnalysis(db, id),
  ]);

  return {
    ...submission,
    analysisDetail,
    reports: reports.map((report) => ({
      ...report,
      createdAt: report.createdAt.toISOString(),
    })),
  };
}

/** The PDF of any submission, whatever its status. */
export async function getAdminSubmissionFile(
  db: Database,
  bucket: R2Bucket,
  id: number,
) {
  const submission = await db.query.submissions.findFirst({
    columns: { fileKey: true },
    where: eq(submissions.id, id),
  });
  return submission ? bucket.get(submission.fileKey) : null;
}

/**
 * Publishes, rejects or re-queues a submission. Only submissions filed under a
 * question can be published, so proposals have to be classified first.
 */
export async function updateSubmissionStatus(
  db: Database,
  watermarkQueue: Queue<WatermarkJob>,
  id: number,
  status: SubmissionStatus,
  reason?: string,
): Promise<AdminSubmission> {
  const submission = await requireAdminSubmission(db, id);
  const rejectionReason = status === "rejected" ? (reason ?? null) : null;
  if (status === "published" && submission.questionId === null) {
    throw new AppError(
      409,
      "NEEDS_CLASSIFICATION",
      "Approve or change the proposed department, course and semester before publishing.",
    );
  }
  if (submission.status !== status) {
    // An admin's decision replaces the AI's.
    await db
      .update(submissions)
      .set({ status, autoPublishedAt: null, rejectionReason })
      .where(eq(submissions.id, id));
    if (status === "published")
      await watermarkIfMissing(db, watermarkQueue, id);
  } else if (status === "rejected" && rejectionReason !== null) {
    // Rejected again: the reason can be reworded.
    await db
      .update(submissions)
      .set({ rejectionReason })
      .where(eq(submissions.id, id));
  }
  return requireAdminSubmission(db, id);
}

const alreadyExists = (what: string) =>
  new AppError(409, "CONFLICT", `${what} already exists`);

/** Creates the department, course and semester that are still new names. */
async function createMissingValues(
  db: Database,
  fields: SubmissionFields,
): Promise<SubmissionFields> {
  const resolved = { ...fields };
  try {
    if (resolved.customDepartmentName) {
      const [row] = await db
        .insert(departments)
        .values({
          name: resolved.customDepartmentName,
          shortName: resolved.customDepartmentShortName!,
        })
        .returning({ id: departments.id });
      resolved.departmentId = row!.id;
    }
  } catch (err) {
    if (isConstraintError(err, "UNIQUE")) {
      throw alreadyExists("A department with this short name");
    }
    throw err;
  }
  try {
    if (resolved.customCourseName) {
      const [row] = await db
        .insert(courses)
        .values({
          name: resolved.customCourseName,
          departmentId: resolved.departmentId!,
        })
        .returning({ id: courses.id });
      resolved.courseId = row!.id;
    }
    if (resolved.customSemesterName) {
      const [row] = await db
        .insert(semesters)
        .values({ name: resolved.customSemesterName })
        .returning({ id: semesters.id });
      resolved.semesterId = row!.id;
    }
  } catch (err) {
    if (isConstraintError(err, "UNIQUE")) throw alreadyExists("This entry");
    throw err;
  }
  delete resolved.customDepartmentName;
  delete resolved.customDepartmentShortName;
  delete resolved.customCourseName;
  delete resolved.customSemesterName;
  return resolved;
}

/**
 * Files a submission under a department, course, semester and exam type (and sets its
 * section and batch), creating any new names first. Approves a proposal as submitted, or corrects a paper that
 * was filed under the wrong details. The status is left as it is.
 */
export async function classifySubmission(
  db: Database,
  id: number,
  input: ClassifySubmissionInput,
): Promise<AdminSubmission> {
  await requireAdminSubmission(db, id);

  const fields = await preferExistingValues(db, input);
  // Checks the given ids first, so nothing is created for an invalid request.
  const questionId =
    (await resolveQuestionId(db, fields)) ??
    (await resolveQuestionId(db, await createMissingValues(db, fields)));
  if (questionId === null) throw notFound();

  await db
    .update(submissions)
    .set({
      questionId,
      // Part of the edit form, so a blank field clears the value.
      section: fields.section ?? null,
      batch: fields.batch ?? null,
      departmentId: null,
      customDepartmentName: null,
      customDepartmentShortName: null,
      courseId: null,
      customCourseName: null,
      semesterId: null,
      customSemesterName: null,
      examTypeId: null,
    })
    .where(eq(submissions.id, id));
  return requireAdminSubmission(db, id);
}

/** Removes a submission in any status, with its PDF, votes and reports. */
export async function deleteSubmission(
  db: Database,
  bucket: R2Bucket,
  id: number,
) {
  const [deleted] = await db
    .delete(submissions)
    .where(eq(submissions.id, id))
    .returning({
      fileKey: submissions.fileKey,
      watermarkedFileKey: submissions.watermarkedFileKey,
    });
  if (!deleted) throw notFound();
  await bucket.delete(submissionFileKeys(deleted));
}

// ── Reports ──────────────────────────────────────────────────────────────────

async function selectReports(
  db: Database,
  where: SQL | undefined,
  page: { limit: number; offset: number },
): Promise<AdminReport[]> {
  const reports = await db
    .select({
      id: submissionReports.id,
      reason: submissionReports.reason,
      details: submissionReports.details,
      status: submissionReports.status,
      createdAt: submissionReports.createdAt,
      updatedAt: submissionReports.updatedAt,
      submissionId: submissionReports.submissionId,
      reporter: reporterColumns,
    })
    .from(submissionReports)
    .innerJoin(user, eq(user.id, submissionReports.reporterId))
    .where(where)
    .orderBy(desc(submissionReports.createdAt), desc(submissionReports.id))
    .limit(page.limit)
    .offset(page.offset);
  if (reports.length === 0) return [];

  const ids = [...new Set(reports.map((report) => report.submissionId))];
  const rows = await selectSubmissionRows(db).where(
    inList(submissions.id, ids),
  );
  const byId = new Map(rows.map((row) => [row.submission.id, row]));

  return reports.map(({ submissionId, ...report }) => {
    const row = byId.get(submissionId)!;
    return {
      ...report,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      submission: {
        id: row.submission.id,
        status: row.submission.status,
        questionId: row.submission.questionId,
        pendingReportCount: row.submission.pendingReportCount,
        classification: toClassification(row),
      },
    };
  });
}

/** Reports, newest first. */
export async function listAdminReports(
  db: Database,
  query: ListAdminReportsQuery,
): Promise<AdminReportList> {
  const where = query.status
    ? eq(submissionReports.status, query.status)
    : undefined;
  const [items, [totals], byStatus] = await Promise.all([
    selectReports(db, where, {
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    }),
    db.select({ total: count() }).from(submissionReports).where(where),
    db
      .select({ status: submissionReports.status, total: count() })
      .from(submissionReports)
      .groupBy(submissionReports.status),
  ]);
  const total = (status: ReportStatus) =>
    byStatus.find((row) => row.status === status)?.total ?? 0;

  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total: totals?.total ?? 0,
    counts: {
      pending: total("pending"),
      resolved: total("resolved"),
      dismissed: total("dismissed"),
    },
  };
}

/**
 * Resolves, dismisses or reopens a report. Triggers keep the paper's pending report
 * count in sync; its status is left alone, so a hidden paper stays hidden until an
 * admin publishes it again.
 */
export async function updateReportStatus(
  db: Database,
  id: number,
  status: ReportStatus,
): Promise<AdminReport> {
  try {
    const updated = await db
      .update(submissionReports)
      .set({ status })
      .where(eq(submissionReports.id, id))
      .returning({ id: submissionReports.id });
    if (updated.length === 0) {
      throw new AppError(404, "NOT_FOUND", "Report not found");
    }
  } catch (err) {
    // Reopening a report while the same user has another open one on the paper.
    if (isConstraintError(err, "UNIQUE")) {
      throw new AppError(
        409,
        "CONFLICT",
        "This user already has an open report on this paper",
      );
    }
    throw err;
  }
  const [report] = await selectReports(db, eq(submissionReports.id, id), {
    limit: 1,
    offset: 0,
  });
  return report!;
}
