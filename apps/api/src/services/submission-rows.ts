import type {
  AdminSubmission,
  AnalysisSummary,
  MySubmission,
  ContributorSubmission,
  SubmissionClassification,
} from "@ourdiu/shared";
import { count, eq, sql, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import type { Database } from "../db/client";
import { usernameOf } from "../db/username";
import {
  courses,
  departments,
  examTypes,
  questions,
  semesters,
  submissionAnalyses as analyses,
  submissionMessages,
  submissions,
  user,
} from "../db/schema";
import { analysisFlag } from "./analysis";
import { publicFileSize } from "./common";

/**
 * True when the AI read a value (name not null) that isn't the submission's: neither
 * the same catalog entry nor the same name, ignoring case.
 */
function aiDiffers(
  aiId: SQLiteColumn,
  aiName: SQLiteColumn,
  id: SQLiteColumn,
  name: SQL | SQLiteColumn,
) {
  return sql`(${aiName} is not null and not coalesce(${aiId} = ${id} or lower(${aiName}) = lower(${name}), 0))`;
}

/**
 * Whether a completed analysis disagrees with the submission's department, course,
 * semester or exam type. Requires the joins of `selectSubmissionRows`; values the AI
 * couldn't read don't count.
 */
export const analysisDiffers = sql<boolean>`(${analyses.status} = 'completed' and (${sql.join(
  [
    aiDiffers(
      analyses.departmentId,
      analyses.departmentName,
      departments.id,
      sql`coalesce(${departments.name}, ${submissions.customDepartmentName})`,
    ),
    aiDiffers(
      analyses.courseId,
      analyses.courseName,
      courses.id,
      sql`coalesce(${courses.name}, ${submissions.customCourseName})`,
    ),
    aiDiffers(
      analyses.semesterId,
      analyses.semesterName,
      semesters.id,
      sql`coalesce(${semesters.name}, ${submissions.customSemesterName})`,
    ),
    aiDiffers(
      analyses.examTypeId,
      analyses.examTypeName,
      examTypes.id,
      examTypes.name,
    ),
  ],
  sql` or `,
)}))`;

/** A completed analysis that says the file isn't exactly one question paper. */
export const analysisFlagged = sql<boolean>`(${analyses.status} = 'completed' and (${analyses.isQuestionPaper} = 0 or ${analyses.paperCount} > 1))`;

/** How a submission row reaches its classification (question or proposal) and analysis. */
const rowJoins = {
  questions: eq(questions.id, submissions.questionId),
  departments: eq(
    departments.id,
    sql`coalesce(${questions.departmentId}, ${submissions.departmentId})`,
  ),
  courses: eq(
    courses.id,
    sql`coalesce(${questions.courseId}, ${submissions.courseId})`,
  ),
  semesters: eq(
    semesters.id,
    sql`coalesce(${questions.semesterId}, ${submissions.semesterId})`,
  ),
  examTypes: eq(
    examTypes.id,
    sql`coalesce(${questions.examTypeId}, ${submissions.examTypeId})`,
  ),
  analyses: eq(analyses.submissionId, submissions.id),
};

/**
 * Submissions with what they are filed under and who uploaded them. Chain `where`,
 * `orderBy`, `limit` and `offset` onto the result.
 *
 * A submission's classification comes from its question when linked, otherwise from
 * its proposed values: existing ids are joined, new names are read from the row.
 */
export function selectSubmissionRows(db: Database) {
  return db
    .select({
      submission: {
        id: submissions.id,
        status: submissions.status,
        fileSize: submissions.fileSize,
        createdAt: submissions.createdAt,
        updatedAt: submissions.updatedAt,
        questionId: submissions.questionId,
        likeCount: submissions.likeCount,
        dislikeCount: submissions.dislikeCount,
        viewCount: submissions.viewCount,
        section: submissions.section,
        batch: submissions.batch,
        pendingReportCount: submissions.pendingReportCount,
      },
      department: {
        id: departments.id,
        name: departments.name,
        shortName: departments.shortName,
      },
      course: { id: courses.id, name: courses.name },
      semester: { id: semesters.id, name: semesters.name },
      examType: { id: examTypes.id, name: examTypes.name },
      customDepartmentName: submissions.customDepartmentName,
      customDepartmentShortName: submissions.customDepartmentShortName,
      customCourseName: submissions.customCourseName,
      customSemesterName: submissions.customSemesterName,
      uploader: {
        id: user.id,
        username: usernameOf,
        name: user.name,
        email: user.email,
        image: user.image,
      },
      autoPublishedAt: submissions.autoPublishedAt,
      rejectionReason: submissions.rejectionReason,
      // Outside `submission`, which the public view spreads.
      uploaderUnread: submissions.uploaderUnread,
      adminUnread: submissions.adminUnread,
      /** The newest request for changes, whatever the status. */
      changesRequested: sql<
        string | null
      >`(select ${submissionMessages.body} from ${submissionMessages} where ${submissionMessages.submissionId} = ${submissions.id} and ${submissionMessages.kind} = 'changes_requested' order by ${submissionMessages.id} desc limit 1)`,
      publicFileSize: publicFileSize.mapWith(Number),
      watermark: {
        status: submissions.watermarkStatus,
        error: submissions.watermarkError,
        fileSize: submissions.watermarkedFileSize,
      },
      analysis: {
        status: analyses.status,
        isQuestionPaper: analyses.isQuestionPaper,
        paperCount: analyses.paperCount,
        differs: analysisDiffers.mapWith(Boolean),
      },
    })
    .from(submissions)
    .leftJoin(questions, rowJoins.questions)
    .leftJoin(departments, rowJoins.departments)
    .leftJoin(courses, rowJoins.courses)
    .leftJoin(semesters, rowJoins.semesters)
    .leftJoin(examTypes, rowJoins.examTypes)
    .leftJoin(user, eq(user.id, submissions.uploaderId))
    .leftJoin(analyses, rowJoins.analyses)
    .$dynamic();
}

/** Counts the rows `selectSubmissionRows` would return for `where`. */
export async function countSubmissionRows(
  db: Database,
  where: SQL | undefined,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(submissions)
    .leftJoin(questions, rowJoins.questions)
    .leftJoin(departments, rowJoins.departments)
    .leftJoin(courses, rowJoins.courses)
    .leftJoin(semesters, rowJoins.semesters)
    .leftJoin(examTypes, rowJoins.examTypes)
    .leftJoin(analyses, rowJoins.analyses)
    .where(where);
  return row?.total ?? 0;
}

export type SubmissionRowData = Awaited<
  ReturnType<typeof selectSubmissionRows>
>[number];

export function toClassification(
  row: SubmissionRowData,
): SubmissionClassification {
  return {
    department: row.department ?? {
      id: null,
      name: row.customDepartmentName ?? "",
      shortName: row.customDepartmentShortName,
    },
    course: row.course ?? { id: null, name: row.customCourseName ?? "" },
    semester: row.semester ?? { id: null, name: row.customSemesterName ?? "" },
    // Always present: required by the submissions CHECK constraint.
    examType: row.examType!,
  };
}

/**
 * The public view of a row: no uploader details, report counts or edit times, and
 * the size of the public (watermarked) copy.
 */
export function toContributorSubmission(
  row: SubmissionRowData,
): ContributorSubmission {
  const {
    pendingReportCount: _,
    updatedAt: __,
    ...submission
  } = row.submission;
  return {
    ...submission,
    fileSize: row.publicFileSize,
    createdAt: submission.createdAt.toISOString(),
    classification: toClassification(row),
  };
}

function toAnalysisSummary(row: SubmissionRowData): AnalysisSummary | null {
  const { analysis } = row;
  // Left joined: null (or all null) when the submission was never analysed.
  if (!analysis?.status) return null;
  const completed = analysis.status === "completed";
  return {
    status: analysis.status,
    flag: completed ? analysisFlag(analysis) : null,
    matches: completed ? !analysis.differs : null,
  };
}

export function toAdminSubmission(row: SubmissionRowData): AdminSubmission {
  return {
    ...row.submission,
    createdAt: row.submission.createdAt.toISOString(),
    updatedAt: row.submission.updatedAt.toISOString(),
    classification: toClassification(row),
    uploader: row.uploader,
    analysis: toAnalysisSummary(row),
    autoPublished: row.autoPublishedAt !== null,
    rejectionReason: row.rejectionReason,
    adminUnread: row.adminUnread,
    watermark: row.watermark?.status
      ? { ...row.watermark, status: row.watermark.status }
      : null,
  };
}

/**
 * The uploader's view: the public fields plus how the review is going. They
 * download their original, so its size.
 */
export function toMySubmission(row: SubmissionRowData): MySubmission {
  return {
    ...toContributorSubmission(row),
    fileSize: row.submission.fileSize,
    autoPublished: row.autoPublishedAt !== null,
    rejectionReason: row.rejectionReason,
    changesRequested:
      row.submission.status === "changes_requested"
        ? row.changesRequested
        : null,
    unread: row.uploaderUnread,
    analysis: toAnalysisSummary(row),
  };
}
