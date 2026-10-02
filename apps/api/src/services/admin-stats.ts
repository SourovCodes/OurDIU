import type { AdminStats } from "@ourdiu/shared";
import { and, count, countDistinct, eq, gte, isNull, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import {
  courses,
  departments,
  examTypes,
  questions,
  semesters,
  submissionReports,
  submissions,
  user,
} from "../db/schema";
import { countWhereStatus } from "./common";

const DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Headline numbers for the admin dashboard. */
export async function getAdminStats(
  db: Database,
  now = Date.now(),
): Promise<AdminStats> {
  // Today (UTC) and the DAYS - 1 days before it.
  const firstDay = Math.floor(now / DAY_MS) * DAY_MS - (DAYS - 1) * DAY_MS;
  const day = sql<string>`date(${submissions.createdAt} / 1000, 'unixepoch')`;
  const total = (query: Promise<{ total: number }[]>) =>
    query.then((rows) => rows[0]?.total ?? 0);

  const [
    [bySubmissionStatus],
    awaitingClassification,
    openReports,
    questionCount,
    userCount,
    contributors,
    paperViews,
    questionViews,
    departmentCount,
    courseCount,
    semesterCount,
    examTypeCount,
    daily,
  ] = await Promise.all([
    db
      .select({
        published: sql<number>`coalesce(${countWhereStatus("published")}, 0)`,
        pendingReview: sql<number>`coalesce(${countWhereStatus("pending_review")}, 0)`,
        rejected: sql<number>`coalesce(${countWhereStatus("rejected")}, 0)`,
        changesRequested: sql<number>`coalesce(${countWhereStatus("changes_requested")}, 0)`,
      })
      .from(submissions),
    total(
      db
        .select({ total: count() })
        .from(submissions)
        .where(
          and(
            eq(submissions.status, "pending_review"),
            isNull(submissions.questionId),
          ),
        ),
    ),
    total(
      db
        .select({ total: count() })
        .from(submissionReports)
        .where(eq(submissionReports.status, "pending")),
    ),
    total(db.select({ total: count() }).from(questions)),
    total(db.select({ total: count() }).from(user)),
    total(
      db
        .select({ total: countDistinct(submissions.uploaderId) })
        .from(submissions),
    ),
    total(
      db
        .select({
          total: sql<number>`coalesce(sum(${submissions.viewCount}), 0)`,
        })
        .from(submissions),
    ),
    total(
      db
        .select({
          total: sql<number>`coalesce(sum(${questions.viewCount}), 0)`,
        })
        .from(questions),
    ),
    total(db.select({ total: count() }).from(departments)),
    total(db.select({ total: count() }).from(courses)),
    total(db.select({ total: count() }).from(semesters)),
    total(db.select({ total: count() }).from(examTypes)),
    db
      .select({ date: day, count: count() })
      .from(submissions)
      .where(gte(submissions.createdAt, new Date(firstDay)))
      .groupBy(day),
  ]);

  const perDay = new Map(daily.map((row) => [row.date, row.count]));
  const dailySubmissions = Array.from({ length: DAYS }, (_, i) => {
    const date = isoDay(firstDay + i * DAY_MS);
    return { date, count: perDay.get(date) ?? 0 };
  });

  return {
    submissions: { ...bySubmissionStatus!, awaitingClassification },
    openReports,
    questions: questionCount,
    users: userCount,
    contributors,
    views: paperViews + questionViews,
    catalog: {
      departments: departmentCount,
      courses: courseCount,
      semesters: semesterCount,
      examTypes: examTypeCount,
    },
    dailySubmissions,
  };
}
