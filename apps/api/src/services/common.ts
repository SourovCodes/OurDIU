import type { SubmissionStatus } from "@ourdiu/shared";
import { asc, desc, sql } from "drizzle-orm";
import {
  courses,
  departments,
  examTypes,
  questions,
  semesters,
  submissions,
} from "../db/schema";

/** Aggregate: number of submissions with the given status in the current group. */
export const countWhereStatus = (status: SubmissionStatus) =>
  sql<number>`sum(case when ${submissions.status} = ${status} then 1 else 0 end)`;

/** Size of the PDF the public downloads: the watermarked copy once it's ready. */
export const publicFileSize = sql<number>`coalesce(${submissions.watermarkedFileSize}, ${submissions.fileSize})`;

/** Sort order for submission lists: published, then pending review, then rejected. */
export const submissionStatusOrder = sql`case ${submissions.status} when 'published' then 0 when 'pending_review' then 1 else 2 end`;

/**
 * Newest semester first. Names are a term and a two-digit year ("Fall 25", see
 * `parseSemesterName`): by year, then term in calendar order (Short, Spring, Summer,
 * Fall). Older names in another format come last, by name. Spread into `orderBy`.
 */
export const semesterRecency = [
  desc(sql`cast(substr(trim(${semesters.name}), -2) as integer)`),
  desc(
    sql`case when ${semesters.name} like '%Fall%' then 3 when ${semesters.name} like '%Summer%' then 2 when ${semesters.name} like '%Spring%' then 1 when ${semesters.name} like '%Short%' then 0 else -1 end`,
  ),
  asc(semesters.name),
];

/**
 * Columns for a question summary. Requires questions to be joined with departments,
 * courses, semesters and exam types.
 */
export const questionSummaryColumns = {
  id: questions.id,
  department: {
    id: departments.id,
    name: departments.name,
    shortName: departments.shortName,
  },
  course: { id: courses.id, name: courses.name },
  semester: { id: semesters.id, name: semesters.name },
  examType: { id: examTypes.id, name: examTypes.name },
};
