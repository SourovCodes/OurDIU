import type {
  ContributorDepartment,
  ContributorDetail,
  ContributorList,
  ContributorPapersQuery,
  ListContributorsQuery,
} from "@ourdiu/shared";
import { and, asc, count, desc, eq, gt, or, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { usernameOf } from "../db/username";
import { inList } from "../db/in-list";
import { departments, questions, submissions, user } from "../db/schema";
import {
  selectSubmissionRows,
  toContributorSubmission,
} from "./submission-rows";

/**
 * Users with published papers. Pending and rejected uploads are private to the
 * uploader and admins, so they are neither counted nor listed publicly. The counts are
 * columns kept up to date by triggers (migration 0006).
 */
function selectContributors(db: Database) {
  return db
    .select({
      id: user.id,
      username: usernameOf,
      name: user.name,
      image: user.image,
      joinedAt: user.createdAt,
      publishedCount: user.publishedSubmissionCount,
      viewCount: user.publishedViewCount,
    })
    .from(user);
}

const isContributor = gt(user.publishedSubmissionCount, 0);

/** Each uploader's published papers per department, the most first. */
async function departmentBreakdown(
  db: Database,
  uploaderIds: string[],
): Promise<Map<string, ContributorDepartment[]>> {
  const byUploader = new Map<string, ContributorDepartment[]>();
  if (uploaderIds.length === 0) return byUploader;
  const rows = await db
    .select({
      uploaderId: submissions.uploaderId,
      id: departments.id,
      name: departments.name,
      shortName: departments.shortName,
      publishedCount: count(),
    })
    .from(submissions)
    .innerJoin(questions, eq(questions.id, submissions.questionId))
    .innerJoin(departments, eq(departments.id, questions.departmentId))
    .where(
      and(
        inList(submissions.uploaderId, uploaderIds),
        eq(submissions.status, "published"),
      ),
    )
    .groupBy(submissions.uploaderId, departments.id)
    .orderBy(desc(count()), asc(departments.name));
  for (const { uploaderId, ...department } of rows) {
    const list = byUploader.get(uploaderId!) ?? [];
    list.push(department);
    byUploader.set(uploaderId!, list);
  }
  return byUploader;
}

export async function listContributors(
  db: Database,
  query: ListContributorsQuery,
): Promise<ContributorList> {
  const [rows, totals] = await Promise.all([
    selectContributors(db)
      .where(isContributor)
      .orderBy(desc(user.publishedSubmissionCount), asc(user.name))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(user).where(isContributor),
  ]);

  const breakdown = await departmentBreakdown(
    db,
    rows.map((row) => row.id),
  );
  return {
    items: rows.map((row) => ({
      ...row,
      joinedAt: row.joinedAt.toISOString(),
      departments: breakdown.get(row.id) ?? [],
    })),
    page: query.page,
    pageSize: query.pageSize,
    total: totals[0]?.total ?? 0,
  };
}

/**
 * A contributor by username, or by id (older links, and rows without a username);
 * the web app redirects those to the username URL.
 */
export async function getContributor(
  db: Database,
  usernameOrId: string,
  query: ContributorPapersQuery,
): Promise<ContributorDetail | null> {
  const [contributor] = await selectContributors(db)
    .where(
      and(
        isContributor,
        or(
          eq(user.username, usernameOrId.toLowerCase()),
          eq(user.id, usernameOrId),
        ),
      ),
    )
    .limit(1);
  if (!contributor) return null;
  const { id } = contributor;

  const published = and(
    eq(submissions.uploaderId, id),
    eq(submissions.status, "published"),
  );
  // Filed papers only have a department through their question.
  const inDepartment = query.departmentId
    ? sql`${submissions.questionId} in (select ${questions.id} from ${questions} where ${questions.departmentId} = ${query.departmentId})`
    : undefined;
  const [rows, breakdown] = await Promise.all([
    selectSubmissionRows(db)
      .where(and(published, inDepartment))
      .orderBy(desc(submissions.createdAt), desc(submissions.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    departmentBreakdown(db, [id]),
  ]);
  const departmentList = breakdown.get(id) ?? [];
  return {
    ...contributor,
    joinedAt: contributor.joinedAt.toISOString(),
    departments: departmentList,
    submissions: {
      items: rows.map(toContributorSubmission),
      page: query.page,
      pageSize: query.pageSize,
      total: query.departmentId
        ? (departmentList.find((d) => d.id === query.departmentId)
            ?.publishedCount ?? 0)
        : contributor.publishedCount,
    },
  };
}
