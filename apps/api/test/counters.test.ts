import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  departments,
  questions,
  submissionReports,
  submissions,
  user,
} from "../src/db/schema";
import {
  db,
  seedQuestion,
  seedSubmission,
  seedTaxonomy,
  seedUser,
} from "./helpers";

// The counters kept by the triggers in migration 0006, checked against the same
// numbers computed from `submissions`.

/** Rows whose stored counters differ from a recount; always 0 when the triggers work. */
async function countMismatches() {
  return env.DB.prepare(
    `SELECT
      (SELECT count(*) FROM questions q WHERE
        q.published_count <> (SELECT count(*) FROM submissions s WHERE s.question_id = q.id AND s.status = 'published')
        OR q.pending_review_count <> (SELECT count(*) FROM submissions s WHERE s.question_id = q.id AND s.status = 'pending_review')
        OR q.rejected_count <> (SELECT count(*) FROM submissions s WHERE s.question_id = q.id AND s.status = 'rejected')
        OR q.latest_published_at IS NOT (SELECT max(created_at) FROM submissions s WHERE s.question_id = q.id AND s.status = 'published')
      ) AS questions,
      (SELECT count(*) FROM departments d WHERE d.published_count <> (
        SELECT count(*) FROM submissions s JOIN questions q ON q.id = s.question_id
        WHERE q.department_id = d.id AND s.status = 'published')
      ) AS departments,
      (SELECT count(*) FROM user u WHERE
        u.published_submission_count <> (SELECT count(*) FROM submissions s WHERE s.uploader_id = u.id AND s.status = 'published')
        OR u.published_view_count <> (SELECT coalesce(sum(view_count), 0) FROM submissions s WHERE s.uploader_id = u.id AND s.status = 'published')
      ) AS users`,
  ).first();
}

async function questionCounts(id: number) {
  const row = await db().query.questions.findFirst({
    where: eq(questions.id, id),
  });
  return {
    published: row!.publishedCount,
    pendingReview: row!.pendingReviewCount,
    rejected: row!.rejectedCount,
    latestPublishedAt: row!.latestPublishedAt?.getTime() ?? null,
  };
}

async function departmentCount(id: number) {
  const row = await db().query.departments.findFirst({
    where: eq(departments.id, id),
  });
  return row!.publishedCount;
}

async function userCounts(id: string) {
  const row = await db().query.user.findFirst({ where: eq(user.id, id) });
  return {
    papers: row!.publishedSubmissionCount,
    views: row!.publishedViewCount,
  };
}

const setStatus = (
  id: number,
  status: "published" | "pending_review" | "rejected",
) => db().update(submissions).set({ status }).where(eq(submissions.id, id));

/** As the API counts a view of a paper (raw SQL, see services/engagement.ts). */
const view = (id: number) =>
  env.DB.prepare(
    "update submissions set view_count = view_count + 1 where id = ? and status = 'published'",
  )
    .bind(id)
    .run();

describe("counter triggers", () => {
  it("follow a paper through review, views, a move, rejection and deletion", async () => {
    const t = await seedTaxonomy();
    const uploader = await seedUser();
    const inCse = await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    });
    const inEee = await seedQuestion({
      departmentId: t.eee.id,
      courseId: t.circuits.id,
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    });

    // Uploaded: pending review.
    const paper = await seedSubmission(inCse.id, {
      status: "pending_review",
      uploaderId: uploader.id,
    });
    expect(await questionCounts(inCse.id)).toEqual({
      published: 0,
      pendingReview: 1,
      rejected: 0,
      latestPublishedAt: null,
    });
    expect(await userCounts(uploader.id)).toEqual({ papers: 0, views: 0 });

    // Published, then viewed twice.
    await setStatus(paper.id, "published");
    await view(paper.id);
    await view(paper.id);
    expect(await questionCounts(inCse.id)).toEqual({
      published: 1,
      pendingReview: 0,
      rejected: 0,
      latestPublishedAt: paper.createdAt.getTime(),
    });
    expect(await departmentCount(t.cse.id)).toBe(1);
    expect(await userCounts(uploader.id)).toEqual({ papers: 1, views: 2 });

    // Moved to a question in another department.
    await db()
      .update(submissions)
      .set({ questionId: inEee.id })
      .where(eq(submissions.id, paper.id));
    expect((await questionCounts(inCse.id)).published).toBe(0);
    expect((await questionCounts(inCse.id)).latestPublishedAt).toBeNull();
    expect((await questionCounts(inEee.id)).published).toBe(1);
    expect(await departmentCount(t.cse.id)).toBe(0);
    expect(await departmentCount(t.eee.id)).toBe(1);

    // Rejected: its views no longer count for the uploader either.
    await setStatus(paper.id, "rejected");
    expect((await questionCounts(inEee.id)).rejected).toBe(1);
    expect(await departmentCount(t.eee.id)).toBe(0);
    expect(await userCounts(uploader.id)).toEqual({ papers: 0, views: 0 });

    // Reclassified to a proposal (no question yet), then deleted.
    await db()
      .update(submissions)
      .set({
        questionId: null,
        departmentId: t.eee.id,
        courseId: t.circuits.id,
        customSemesterName: "Fall 99",
        examTypeId: t.midterm.id,
        status: "pending_review",
      })
      .where(eq(submissions.id, paper.id));
    expect(await questionCounts(inEee.id)).toMatchObject({
      rejected: 0,
      pendingReview: 0,
    });
    await db().delete(submissions).where(eq(submissions.id, paper.id));

    expect(await countMismatches()).toEqual({
      questions: 0,
      departments: 0,
      users: 0,
    });
  });

  it("keep the newest published paper and drop papers hidden by reports", async () => {
    const t = await seedTaxonomy();
    const uploader = await seedUser();
    const question = await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.final.id,
    });
    const older = await seedSubmission(question.id, {
      uploaderId: uploader.id,
      createdAt: new Date(Date.now() - 60_000),
    });
    const newer = await seedSubmission(question.id, {
      uploaderId: uploader.id,
    });
    expect(await questionCounts(question.id)).toMatchObject({
      published: 2,
      latestPublishedAt: newer.createdAt.getTime(),
    });
    expect(await departmentCount(t.cse.id)).toBe(2);

    // The third open report hides the newer paper (trigger in migration 0001).
    for (const reporter of await Promise.all([
      seedUser(),
      seedUser(),
      seedUser(),
    ])) {
      await db().insert(submissionReports).values({
        submissionId: newer.id,
        reporterId: reporter.id,
        reason: "wrong_details",
      });
    }
    expect(await questionCounts(question.id)).toEqual({
      published: 1,
      pendingReview: 1,
      rejected: 0,
      latestPublishedAt: older.createdAt.getTime(),
    });
    expect(await departmentCount(t.cse.id)).toBe(1);
    expect(await userCounts(uploader.id)).toEqual({ papers: 1, views: 0 });

    // Views of an unpublished paper don't count (the API skips them anyway).
    await db()
      .update(submissions)
      .set({ viewCount: 5 })
      .where(eq(submissions.id, newer.id));
    expect(await userCounts(uploader.id)).toEqual({ papers: 1, views: 0 });

    expect(await countMismatches()).toEqual({
      questions: 0,
      departments: 0,
      users: 0,
    });
  });
});
