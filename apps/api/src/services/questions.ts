import type {
  ListQuestionsQuery,
  Question,
  QuestionDetail,
  QuestionList,
} from "@ourdiu/shared";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  isNotNull,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Database } from "../db/client";
import { usernameOf } from "../db/username";
import {
  courses,
  departments,
  examTypes,
  questions,
  semesters,
  submissions,
  submissionTexts,
  trendingQuestions,
  user,
} from "../db/schema";
import { paperFileName } from "../lib/files";
import {
  publicFileSize,
  questionSummaryColumns,
  semesterRecency,
  submissionStatusOrder,
} from "./common";

/**
 * Questions joined with their lookup names. The submission counts are columns kept up
 * to date by triggers (migration 0006); today's views come from the cron's list.
 */
function selectQuestions(db: Database) {
  return db
    .select({
      ...questionSummaryColumns,
      viewCount: questions.viewCount,
      viewsToday: trendingQuestions.views,
      submissionCounts: {
        published: questions.publishedCount,
        pendingReview: questions.pendingReviewCount,
        rejected: questions.rejectedCount,
      },
    })
    .from(questions)
    .innerJoin(departments, eq(departments.id, questions.departmentId))
    .innerJoin(courses, eq(courses.id, questions.courseId))
    .innerJoin(semesters, eq(semesters.id, questions.semesterId))
    .innerJoin(examTypes, eq(examTypes.id, questions.examTypeId))
    .leftJoin(
      trendingQuestions,
      eq(trendingQuestions.questionId, questions.id),
    );
}

/** Set exactly when a question has a published paper; indexed, unlike the count. */
const hasPublished = isNotNull(questions.latestPublishedAt);

function questionFilters(query: ListQuestionsQuery) {
  const filters: SQL[] = [];
  if (query.departmentId)
    filters.push(eq(questions.departmentId, query.departmentId));
  if (query.courseId) filters.push(eq(questions.courseId, query.courseId));
  if (query.semesterId)
    filters.push(eq(questions.semesterId, query.semesterId));
  if (query.examTypeId)
    filters.push(eq(questions.examTypeId, query.examTypeId));
  return and(...filters);
}

const QUESTION_ORDER = {
  // Grouped by course and exam type with the newest semester first, since students
  // compare one exam across semesters.
  az: [
    asc(departments.shortName),
    asc(courses.name),
    asc(examTypes.name),
    ...semesterRecency,
  ],
  // By the indexed column alone (ids break ties), so SQLite can read the first page
  // straight off an index instead of sorting every question.
  newest: [desc(questions.latestPublishedAt)],
  popular: [desc(questions.viewCount)],
  // Only the questions in the cron's list (see `listQuestions`), most views first.
  trending: [desc(trendingQuestions.views)],
} as const;

/**
 * Questions with at least one published paper; ones whose papers are all still under
 * review (or rejected) have nothing to read yet. Newest papers first by default.
 */
export async function listQuestions(
  db: Database,
  query: ListQuestionsQuery,
): Promise<QuestionList> {
  const where = and(
    questionFilters(query),
    hasPublished,
    // The list holds the top 100 of the last 24 hours; others weren't viewed enough.
    query.sort === "trending"
      ? isNotNull(trendingQuestions.questionId)
      : undefined,
  );
  const [items, totals] = await Promise.all([
    selectQuestions(db)
      .where(where)
      .orderBy(...QUESTION_ORDER[query.sort], desc(questions.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    query.sort === "trending"
      ? db
          .select({ total: count() })
          .from(trendingQuestions)
          .innerJoin(questions, eq(questions.id, trendingQuestions.questionId))
          .where(where)
      : db.select({ total: count() }).from(questions).where(where),
  ]);

  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total: totals[0]?.total ?? 0,
  };
}

/**
 * `filesUrl`: origin of the public R2 domain (FILES_URL). Empty in local dev, where
 * files are only served through the API.
 */
export async function getQuestion(
  db: Database,
  id: number,
  filesUrl: string,
): Promise<Omit<QuestionDetail, "viewToken"> | null> {
  // Like the lists, a question without any submission doesn't exist publicly.
  const [question]: Question[] = await selectQuestions(db)
    .where(
      and(
        eq(questions.id, id),
        gt(
          sql`${questions.publishedCount} + ${questions.pendingReviewCount} + ${questions.rejectedCount}`,
          0,
        ),
      ),
    )
    .limit(1);
  if (!question) return null;

  // Metadata only: the only file key that leaves the API is a published paper's
  // watermarked copy (as its URL), and uploaders expose just their public profile.
  const rows = await db
    .select({
      id: submissions.id,
      status: submissions.status,
      fileSize: publicFileSize,
      createdAt: submissions.createdAt,
      likeCount: submissions.likeCount,
      dislikeCount: submissions.dislikeCount,
      viewCount: submissions.viewCount,
      section: submissions.section,
      batch: submissions.batch,
      uploader: {
        id: user.id,
        username: usernameOf,
        name: user.name,
        image: user.image,
      },
      watermarkedFileKey: submissions.watermarkedFileKey,
      text: submissionTexts.text,
    })
    .from(submissions)
    .leftJoin(user, eq(user.id, submissions.uploaderId))
    .leftJoin(submissionTexts, eq(submissionTexts.submissionId, submissions.id))
    .where(eq(submissions.questionId, id))
    // Ranking within a status: score, then views, then newest.
    .orderBy(
      submissionStatusOrder,
      desc(sql`${submissions.likeCount} - ${submissions.dislikeCount}`),
      desc(submissions.viewCount),
      desc(submissions.createdAt),
    );

  return {
    ...question,
    submissions: rows.map(({ watermarkedFileKey, text, ...row }) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      fileUrl: publicFileUrl(row, watermarkedFileKey, filesUrl),
      // Only a published paper's text is public, like its file.
      text: row.status === "published" ? text : null,
    })),
  };
}

function publicFileUrl(
  row: { id: number; status: string },
  watermarkedFileKey: string | null,
  filesUrl: string,
) {
  if (row.status !== "published") return null;
  return filesUrl && watermarkedFileKey
    ? `${filesUrl.replace(/\/$/, "")}/${watermarkedFileKey}`
    : `/api/v1/submissions/${row.id}/file`;
}

/**
 * The public PDF of a published submission: its watermarked copy, or the original
 * until the copy is ready, with the name to save it under. Null if the submission
 * isn't public.
 */
export async function getPublishedSubmissionFile(
  db: Database,
  bucket: R2Bucket,
  id: number,
): Promise<{
  object: R2ObjectBody;
  watermarked: boolean;
  filename: string;
} | null> {
  const [submission] = await db
    .select({
      fileKey: submissions.fileKey,
      watermarkedFileKey: submissions.watermarkedFileKey,
      course: courses.name,
      examType: examTypes.name,
      semester: semesters.name,
    })
    .from(submissions)
    .innerJoin(questions, eq(questions.id, submissions.questionId))
    .innerJoin(courses, eq(courses.id, questions.courseId))
    .innerJoin(examTypes, eq(examTypes.id, questions.examTypeId))
    .innerJoin(semesters, eq(semesters.id, questions.semesterId))
    .where(and(eq(submissions.id, id), eq(submissions.status, "published")))
    .limit(1);
  if (!submission) return null;
  const filename = paperFileName(submission);
  if (submission.watermarkedFileKey) {
    const object = await bucket.get(submission.watermarkedFileKey);
    if (object) return { object, watermarked: true, filename };
  }
  const object = await bucket.get(submission.fileKey);
  return object ? { object, watermarked: false, filename } : null;
}
