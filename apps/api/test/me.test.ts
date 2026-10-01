import { env } from "cloudflare:workers";
import type {
  MySubmissionDetail,
  MySubmissionList,
  Profile,
} from "@ourdiu/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { submissionAnalyses, submissions } from "../src/db/schema";
import {
  api,
  db,
  seedQuestion,
  seedSubmission,
  seedTaxonomy,
  signIn,
} from "./helpers";

async function signedInUser() {
  const { cookie } = await signIn();
  const res = await api("/api/auth/get-session", { headers: { cookie } });
  const session = await res.json<{ user: { id: string } }>();
  return { cookie, id: session.user.id };
}

async function seedAnyQuestion() {
  const t = await seedTaxonomy();
  return seedQuestion({
    departmentId: t.cse.id,
    courseId: t.algorithms.id,
    semesterId: t.sem1.id,
    examTypeId: t.midterm.id,
  });
}

async function seedStoredSubmission(
  questionId: number,
  uploaderId: string,
  status: "published" | "pending_review" | "rejected",
) {
  const row = await seedSubmission(questionId, { uploaderId, status });
  await env.BUCKET.put(row.fileKey, "%PDF-1.7\n%test\n", {
    httpMetadata: { contentType: "application/pdf" },
  });
  return row;
}

const findSubmission = (id: number) =>
  db().query.submissions.findFirst({ where: eq(submissions.id, id) });

describe("GET /api/v1/me", () => {
  it("requires sign-in", async () => {
    const res = await api("/api/v1/me");
    expect(res.status).toBe(401);
  });

  it("returns your profile with your published papers and their views", async () => {
    const { cookie, id } = await signedInUser();
    const question = await seedAnyQuestion();
    const published = await seedSubmission(question.id, {
      uploaderId: id,
      status: "published",
    });
    await seedSubmission(question.id, {
      uploaderId: id,
      status: "pending_review",
    });
    await db()
      .update(submissions)
      .set({ viewCount: 12 })
      .where(eq(submissions.id, published.id));

    const res = await api("/api/v1/me", { headers: { cookie } });

    expect(res.status).toBe(200);
    const profile = await res.json<Profile>();
    expect(profile).toMatchObject({
      id,
      name: "Test User",
      publishedCount: 1,
      viewCount: 12,
      image: null,
      canContribute: true,
    });
    expect(profile.email).toMatch(/@diu\.edu\.bd$/);
    expect(profile.username).toMatch(/^user_/);
  });

  it("says an account on another email can't contribute", async () => {
    const { cookie } = await signIn(`reader-${crypto.randomUUID()}@gmail.com`);

    const res = await api("/api/v1/me", { headers: { cookie } });

    expect(await res.json<Profile>()).toMatchObject({ canContribute: false });
  });
});

describe("GET /api/v1/me/submissions", () => {
  it("requires sign-in", async () => {
    const res = await api("/api/v1/me/submissions");
    expect(res.status).toBe(401);
  });

  it("lists only the signed-in user's submissions, in every status", async () => {
    const question = await seedAnyQuestion();
    const me = await signedInUser();
    const other = await signedInUser();
    const rejected = await seedSubmission(question.id, {
      uploaderId: me.id,
      status: "rejected",
    });
    const published = await seedSubmission(question.id, { uploaderId: me.id });
    const pending = await seedSubmission(question.id, {
      uploaderId: me.id,
      status: "pending_review",
    });
    await seedSubmission(question.id, { uploaderId: other.id });

    const res = await api("/api/v1/me/submissions", {
      headers: { cookie: me.cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json<MySubmissionList>();
    expect(body.items.map((s) => s.id)).toEqual([
      published.id,
      pending.id,
      rejected.id,
    ]);
    expect(body.items[1]).toMatchObject({
      status: "pending_review",
      questionId: question.id,
    });
  });
});

describe("GET /api/v1/me/submissions/{id}", () => {
  it("shows the uploader the review status and what the AI read", async () => {
    const question = await seedAnyQuestion();
    const me = await signedInUser();
    const other = await signedInUser();
    const paper = await seedSubmission(question.id, {
      uploaderId: me.id,
      status: "published",
      autoPublishedAt: new Date(),
    });
    await db().insert(submissionAnalyses).values({
      submissionId: paper.id,
      runId: crypto.randomUUID(),
      status: "completed",
      isQuestionPaper: true,
      paperCount: 1,
      note: "One final exam paper.",
      courseName: "Algorithms",
      error: "internal detail",
      completedAt: new Date(),
    });

    const res = await api(`/api/v1/me/submissions/${paper.id}`, {
      headers: { cookie: me.cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json<MySubmissionDetail>();
    expect(body).toMatchObject({
      id: paper.id,
      status: "published",
      autoPublished: true,
      analysis: { status: "completed", flag: null },
      analysisDetail: {
        status: "completed",
        note: "One final exam paper.",
        values: { course: { id: null, name: "Algorithms" } },
      },
    });
    // Errors and costs stay with the admins.
    expect(body.analysisDetail).not.toHaveProperty("error");
    expect(body.analysisDetail).not.toHaveProperty("sentBytes");

    const list = await (
      await api("/api/v1/me/submissions", { headers: { cookie: me.cookie } })
    ).json<MySubmissionList>();
    expect(list.items[0]).toMatchObject({ id: paper.id, autoPublished: true });

    const hidden = await api(`/api/v1/me/submissions/${paper.id}`, {
      headers: { cookie: other.cookie },
    });
    expect(hidden.status).toBe(404);
  });
});

describe("PUT /api/v1/me/submissions/{id}/classification", () => {
  const reclassify = (id: number, body: unknown, cookie: string) =>
    api(`/api/v1/me/submissions/${id}/classification`, {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("lets the uploader fix details and publishes when they match the AI", async () => {
    const t = await seedTaxonomy();
    const wrong = await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.final.id,
    });
    const me = await signedInUser();
    const paper = await seedSubmission(wrong.id, {
      uploaderId: me.id,
      status: "pending_review",
    });
    // The AI read the midterm, not the final.
    await db().insert(submissionAnalyses).values({
      submissionId: paper.id,
      runId: crypto.randomUUID(),
      status: "completed",
      isQuestionPaper: true,
      paperCount: 1,
      departmentId: t.cse.id,
      departmentName: t.cse.name,
      courseId: t.algorithms.id,
      courseName: t.algorithms.name,
      semesterId: t.sem1.id,
      semesterName: t.sem1.name,
      examTypeId: t.midterm.id,
      examTypeName: t.midterm.name,
      completedAt: new Date(),
    });

    const res = await reclassify(
      paper.id,
      {
        departmentId: t.cse.id,
        courseId: t.algorithms.id,
        semesterId: t.sem1.id,
        examTypeId: t.midterm.id,
        batch: "61",
      },
      me.cookie,
    );
    expect(res.status).toBe(200);
    const body = await res.json<MySubmissionDetail>();
    expect(body).toMatchObject({
      status: "published",
      autoPublished: true,
      batch: "61",
      classification: { examType: { id: t.midterm.id } },
    });

    // Published papers can't be changed any more.
    const again = await reclassify(
      paper.id,
      {
        departmentId: t.cse.id,
        courseId: t.algorithms.id,
        semesterId: t.sem1.id,
        examTypeId: t.final.id,
      },
      me.cookie,
    );
    expect(again.status).toBe(409);
  });

  it("keeps new names as a proposal for an admin, and hides others' papers", async () => {
    const question = await seedAnyQuestion();
    const me = await signedInUser();
    const other = await signedInUser();
    const paper = await seedSubmission(question.id, {
      uploaderId: me.id,
      status: "pending_review",
    });
    const body = {
      departmentId: question.departmentId,
      customCourseName: "Compiler Design",
      semesterId: question.semesterId,
      examTypeId: question.examTypeId,
    };

    expect((await reclassify(paper.id, body, other.cookie)).status).toBe(404);

    const res = await reclassify(paper.id, body, me.cookie);
    expect(res.status).toBe(200);
    expect(await findSubmission(paper.id)).toMatchObject({
      status: "pending_review",
      questionId: null,
      customCourseName: "Compiler Design",
    });
  });
});

describe("GET /api/v1/me/submissions/{id}/file", () => {
  it("serves the uploader's unpublished PDF without caching, and hides it from others", async () => {
    const question = await seedAnyQuestion();
    const me = await signedInUser();
    const other = await signedInUser();
    const pending = await seedStoredSubmission(
      question.id,
      me.id,
      "pending_review",
    );
    const path = `/api/v1/me/submissions/${pending.id}/file`;

    const res = await api(path, { headers: { cookie: me.cookie } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(new TextDecoder().decode(await res.arrayBuffer())).toMatch(/^%PDF-/);

    const forOther = await api(path, { headers: { cookie: other.cookie } });
    expect(forOther.status).toBe(404);
    expect((await api(path)).status).toBe(401);
  });
});

describe("DELETE /api/v1/me/submissions/{id}", () => {
  it.each(["pending_review", "rejected"] as const)(
    "withdraws a %s submission and deletes its PDF",
    async (status) => {
      const question = await seedAnyQuestion();
      const me = await signedInUser();
      const submission = await seedStoredSubmission(question.id, me.id, status);

      const res = await api(`/api/v1/me/submissions/${submission.id}`, {
        method: "DELETE",
        headers: { cookie: me.cookie },
      });
      expect(res.status).toBe(204);
      expect(await findSubmission(submission.id)).toBeUndefined();
      expect(await env.BUCKET.head(submission.fileKey)).toBeNull();
    },
  );

  it("refuses to withdraw a published paper", async () => {
    const question = await seedAnyQuestion();
    const me = await signedInUser();
    const published = await seedStoredSubmission(
      question.id,
      me.id,
      "published",
    );

    const res = await api(`/api/v1/me/submissions/${published.id}`, {
      method: "DELETE",
      headers: { cookie: me.cookie },
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: "CONFLICT" } });
    expect(await findSubmission(published.id)).toBeDefined();
    expect(await env.BUCKET.head(published.fileKey)).not.toBeNull();
  });

  it("doesn't touch another user's submission", async () => {
    const question = await seedAnyQuestion();
    const owner = await signedInUser();
    const other = await signedInUser();
    const pending = await seedStoredSubmission(
      question.id,
      owner.id,
      "pending_review",
    );

    const res = await api(`/api/v1/me/submissions/${pending.id}`, {
      method: "DELETE",
      headers: { cookie: other.cookie },
    });
    expect(res.status).toBe(404);
    expect(await findSubmission(pending.id)).toBeDefined();
  });
});
