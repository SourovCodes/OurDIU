import { env } from "cloudflare:workers";
import type {
  AdminReport,
  AdminReportList,
  AdminStats,
  AdminSubmission,
  AdminSubmissionDetail,
  AdminSubmissionList,
} from "@ourdiu/shared";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import {
  departments,
  questions,
  submissionReports,
  submissions,
  submissionVotes,
} from "../src/db/schema";
import {
  api,
  db,
  jsonRequest,
  seedSubmission,
  seedTaxonomy,
  signInAdmin,
  signIn,
} from "./helpers";

type Taxonomy = Awaited<ReturnType<typeof seedTaxonomy>>;

let admin: Awaited<ReturnType<typeof signInAdmin>>;
let member: Awaited<ReturnType<typeof signIn>>;
let t: Taxonomy;

beforeAll(async () => {
  [admin, member, t] = await Promise.all([
    signInAdmin(),
    signIn(),
    seedTaxonomy(),
  ]);
});

const asAdmin = (path: string, init: RequestInit = {}) =>
  api(path, {
    ...init,
    headers: { ...(init.headers as object), cookie: admin.cookie },
  });

/** Finds or creates the Algorithms question for a semester and exam type. */
async function seedAnyQuestion(
  semester: "sem1" | "sem2" = "sem1",
  examType: "midterm" | "final" = "midterm",
) {
  const values = {
    departmentId: t.cse.id,
    courseId: t.algorithms.id,
    semesterId: t[semester].id,
    examTypeId: t[examType].id,
  };
  await db().insert(questions).values(values).onConflictDoNothing();
  const question = await db().query.questions.findFirst({
    where: and(
      eq(questions.courseId, values.courseId),
      eq(questions.semesterId, values.semesterId),
      eq(questions.examTypeId, values.examTypeId),
    ),
  });
  return question!;
}

/** A pending submission that proposes a new course and semester. */
async function seedProposal() {
  const id = crypto.randomUUID();
  const [row] = await db()
    .insert(submissions)
    .values({
      fileKey: `submissions/${id}.pdf`,
      fileSize: 1234,
      uploaderId: member.id,
      departmentId: t.cse.id,
      customCourseName: `Compilers ${id.slice(0, 6)}`,
      customSemesterName: "Short 18",
      examTypeId: t.final.id,
    })
    .returning();
  return row!;
}

describe("admin access", () => {
  it("requires sign-in and the admin role", async () => {
    const paths = [
      "/api/v1/admin/stats",
      "/api/v1/admin/submissions",
      "/api/v1/admin/reports",
      "/api/v1/admin/catalog",
      "/api/v1/admin/users",
    ];
    for (const path of paths) {
      expect((await api(path)).status, path).toBe(401);
      const res = await api(path, { headers: { cookie: member.cookie } });
      expect(res.status, path).toBe(403);
      expect(await res.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
      expect((await asAdmin(path)).status, path).toBe(200);
    }
  });

  it("returns the role with the session, and users can't set it themselves", async () => {
    const res = await api("/api/auth/get-session", {
      headers: { cookie: admin.cookie },
    });
    expect(await res.json()).toMatchObject({ user: { role: "admin" } });

    const signIn = await api(
      "/api/auth/sign-up/email",
      jsonRequest("POST", {
        name: "Sneaky",
        email: `sneaky-${crypto.randomUUID()}@example.com`,
        password: "correct-horse-battery",
        role: "admin",
      }),
    );
    // Fields marked `input: false` are ignored (or rejected): never an admin.
    if (signIn.ok) {
      const cookie = signIn.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; ");
      const session = await api("/api/auth/get-session", {
        headers: { cookie },
      });
      expect(await session.json()).toMatchObject({ user: { role: "user" } });
    }

    await api(
      "/api/auth/update-user",
      jsonRequest("POST", { role: "admin" }, member.cookie),
    );
    const session = await api("/api/auth/get-session", {
      headers: { cookie: member.cookie },
    });
    expect(await session.json()).toMatchObject({ user: { role: "user" } });
  });
});

describe("GET /api/v1/admin/submissions", () => {
  it("lists every status with uploader emails, filters by status and counts each", async () => {
    const question = await seedAnyQuestion();
    const pending = await seedSubmission(question.id, {
      status: "pending_review",
      uploaderId: member.id,
    });
    const reported = await seedSubmission(question.id, {
      uploaderId: member.id,
    });
    await db().insert(submissionReports).values({
      submissionId: reported.id,
      reporterId: admin.id,
      reason: "unreadable",
    });

    const all = await asAdmin("/api/v1/admin/submissions?pageSize=100");
    const body = await all.json<AdminSubmissionList>();
    // Reported papers come first.
    expect(body.items[0]).toMatchObject({
      id: reported.id,
      pendingReportCount: 1,
    });
    expect(body.items.find((s) => s.id === pending.id)).toMatchObject({
      status: "pending_review",
      uploader: { id: member.id, email: member.email },
      classification: {
        course: { id: t.algorithms.id, name: t.algorithms.name },
      },
    });
    expect(body.counts.pendingReview).toBeGreaterThanOrEqual(1);

    const filtered = await asAdmin(
      "/api/v1/admin/submissions?status=pending_review&pageSize=100",
    );
    const pendingOnly = await filtered.json<AdminSubmissionList>();
    expect(pendingOnly.items.every((s) => s.status === "pending_review")).toBe(
      true,
    );
    expect(pendingOnly.total).toBe(pendingOnly.counts.pendingReview);
  });
});

describe("GET /api/v1/admin/submissions/{id}", () => {
  it("includes reports with their reporters, and 404s for unknown ids", async () => {
    const question = await seedAnyQuestion();
    const submission = await seedSubmission(question.id);
    await db().insert(submissionReports).values({
      submissionId: submission.id,
      reporterId: member.id,
      reason: "other",
      details: "Page 2 is missing",
    });

    const res = await asAdmin(`/api/v1/admin/submissions/${submission.id}`);
    expect(res.status).toBe(200);
    const body = await res.json<AdminSubmissionDetail>();
    expect(body.uploader).toBeNull();
    expect(body.reports).toEqual([
      expect.objectContaining({
        reason: "other",
        details: "Page 2 is missing",
        status: "pending",
        reporter: expect.objectContaining({ id: member.id }),
      }),
    ]);

    expect((await asAdmin("/api/v1/admin/submissions/999999")).status).toBe(
      404,
    );
  });
});

describe("GET /api/v1/admin/submissions/{id}/file", () => {
  it("serves unpublished PDFs to admins without caching", async () => {
    const question = await seedAnyQuestion();
    const submission = await seedSubmission(question.id, {
      status: "rejected",
    });
    await env.BUCKET.put(submission.fileKey, "%PDF-1.7\n%admin\n");

    const res = await asAdmin(
      `/api/v1/admin/submissions/${submission.id}/file`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.text()).toContain("%admin");

    const denied = await api(
      `/api/v1/admin/submissions/${submission.id}/file`,
      { headers: { cookie: member.cookie } },
    );
    expect(denied.status).toBe(403);
  });
});

describe("PATCH /api/v1/admin/submissions/{id}", () => {
  const setStatus = (
    id: number,
    status: string,
    reason = status === "rejected" ? "Not a question paper." : undefined,
  ) =>
    asAdmin(
      `/api/v1/admin/submissions/${id}`,
      jsonRequest("PATCH", { status, reason }),
    );

  it("publishes, rejects and re-queues a submission", async () => {
    const question = await seedAnyQuestion();
    const submission = await seedSubmission(question.id, {
      status: "pending_review",
    });

    for (const status of ["published", "rejected", "pending_review"]) {
      const res = await setStatus(submission.id, status);
      expect(res.status).toBe(200);
      expect(await res.json<AdminSubmission>()).toMatchObject({ status });
    }

    expect((await setStatus(submission.id, "archived")).status).toBe(422);
    expect((await setStatus(999_999, "published")).status).toBe(404);
  });

  it("rejects with a reason for the uploader, and clears it otherwise", async () => {
    const question = await seedAnyQuestion();
    const submission = await seedSubmission(question.id, {
      status: "pending_review",
      uploaderId: member.id,
    });

    const missing = await setStatus(submission.id, "rejected", "  ");
    expect(missing.status).toBe(422);

    const reason = "This PDF contains multiple question papers.";
    const rejected = await setStatus(submission.id, "rejected", reason);
    expect(await rejected.json<AdminSubmission>()).toMatchObject({
      status: "rejected",
      rejectionReason: reason,
    });
    // The uploader sees it.
    const mine = await api(`/api/v1/me/submissions/${submission.id}`, {
      headers: { cookie: member.cookie },
    });
    expect(await mine.json()).toMatchObject({ rejectionReason: reason });

    // Rejected again: the reason is reworded.
    const reworded = await setStatus(submission.id, "rejected", "Duplicate.");
    expect(await reworded.json()).toMatchObject({
      rejectionReason: "Duplicate.",
    });

    const back = await setStatus(submission.id, "pending_review");
    expect(await back.json()).toMatchObject({ rejectionReason: null });
  });

  it("won't publish a proposal before it is classified", async () => {
    const proposal = await seedProposal();
    const res = await setStatus(proposal.id, "published");
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: { code: "NEEDS_CLASSIFICATION" },
    });
    // Rejecting doesn't need a question.
    expect((await setStatus(proposal.id, "rejected")).status).toBe(200);
  });
});

describe("PUT /api/v1/admin/submissions/{id}/classification", () => {
  const classify = (id: number, body: unknown) =>
    asAdmin(
      `/api/v1/admin/submissions/${id}/classification`,
      jsonRequest("PUT", body),
    );

  it("approves a proposal by creating its new entries and linking a question", async () => {
    const proposal = await seedProposal();
    const res = await classify(proposal.id, {
      departmentId: t.cse.id,
      customCourseName: proposal.customCourseName,
      customSemesterName: proposal.customSemesterName,
      examTypeId: t.final.id,
    });
    expect(res.status).toBe(200);
    const body = await res.json<AdminSubmission>();
    expect(body.status).toBe("pending_review");
    expect(body.questionId).not.toBeNull();
    expect(body.classification).toMatchObject({
      department: { id: t.cse.id },
      course: { name: proposal.customCourseName },
      semester: { name: proposal.customSemesterName },
      examType: { id: t.final.id },
    });
    expect(body.classification.course.id).not.toBeNull();

    // The proposed values are gone from the row, and it can now be published.
    const row = await db().query.submissions.findFirst({
      where: eq(submissions.id, proposal.id),
    });
    expect(row).toMatchObject({
      customCourseName: null,
      customSemesterName: null,
      departmentId: null,
      examTypeId: null,
    });
    const published = await asAdmin(
      `/api/v1/admin/submissions/${proposal.id}`,
      jsonRequest("PATCH", { status: "published" }),
    );
    expect(published.status).toBe(200);
  });

  it("moves a paper to existing values, reusing the question", async () => {
    const question = await seedAnyQuestion("sem2", "final");
    const submission = await seedSubmission(
      (await seedAnyQuestion("sem1", "midterm")).id,
    );
    const res = await classify(submission.id, {
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem2.id,
      examTypeId: t.final.id,
    });
    expect(res.status).toBe(200);
    expect(await res.json<AdminSubmission>()).toMatchObject({
      questionId: question.id,
      status: "published",
    });
  });

  it("sets the section and batch, clearing ones left out", async () => {
    const question = await seedAnyQuestion("sem1", "final");
    const submission = await seedSubmission(question.id);
    const fields = {
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.final.id,
    };

    const set = await classify(submission.id, {
      ...fields,
      section: "5A",
      batch: "61",
    });
    expect(await set.json<AdminSubmission>()).toMatchObject({
      section: "5A",
      batch: "61",
    });
    const cleared = await classify(submission.id, fields);
    expect(await cleared.json<AdminSubmission>()).toMatchObject({
      section: null,
      batch: null,
    });
  });

  it("creates a new department with its short name", async () => {
    const proposal = await seedProposal();
    const tag = crypto.randomUUID().slice(0, 6);
    const input = {
      customDepartmentName: `Marine Science ${tag}`,
      customCourseName: "Oceanography",
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    };

    const missingShortName = await classify(proposal.id, input);
    expect(missingShortName.status).toBe(422);

    const res = await classify(proposal.id, {
      ...input,
      customDepartmentShortName: `MS-${tag}`,
    });
    expect(res.status).toBe(200);
    const department = await db().query.departments.findFirst({
      where: eq(departments.shortName, `MS-${tag}`),
    });
    expect(department?.name).toBe(`Marine Science ${tag}`);
  });

  it("rejects mismatched ids and short names that are taken", async () => {
    const proposal = await seedProposal();
    const mismatch = await classify(proposal.id, {
      departmentId: t.eee.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    });
    expect(mismatch.status).toBe(422);

    const taken = await classify(proposal.id, {
      customDepartmentName: `Brand new ${crypto.randomUUID()}`,
      customDepartmentShortName: t.eee.shortName,
      customCourseName: "Anything",
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    });
    expect(taken.status).toBe(409);

    // Nothing changed.
    const row = await db().query.submissions.findFirst({
      where: eq(submissions.id, proposal.id),
    });
    expect(row?.questionId).toBeNull();
  });
});

describe("DELETE /api/v1/admin/submissions/{id}", () => {
  it("deletes a published paper with its PDF, votes and reports", async () => {
    const question = await seedAnyQuestion();
    const submission = await seedSubmission(question.id);
    await env.BUCKET.put(submission.fileKey, "%PDF-1.7\n");
    await db()
      .insert(submissionVotes)
      .values({ submissionId: submission.id, userId: member.id, value: 1 });

    const res = await asAdmin(`/api/v1/admin/submissions/${submission.id}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);
    expect(await env.BUCKET.get(submission.fileKey)).toBeNull();
    expect(
      await db().query.submissions.findFirst({
        where: eq(submissions.id, submission.id),
      }),
    ).toBeUndefined();

    const again = await asAdmin(`/api/v1/admin/submissions/${submission.id}`, {
      method: "DELETE",
    });
    expect(again.status).toBe(404);
  });
});

describe("admin reports", () => {
  it("lists reports by status and resolves them, updating the paper's count", async () => {
    const question = await seedAnyQuestion();
    const submission = await seedSubmission(question.id);
    const [report] = await db()
      .insert(submissionReports)
      .values({
        submissionId: submission.id,
        reporterId: member.id,
        reason: "wrong_file",
      })
      .returning();

    const list = await asAdmin("/api/v1/admin/reports?status=pending");
    const body = await list.json<AdminReportList>();
    expect(body.items.find((r) => r.id === report!.id)).toMatchObject({
      reason: "wrong_file",
      reporter: { id: member.id, email: member.email },
      submission: {
        id: submission.id,
        status: "published",
        pendingReportCount: 1,
        classification: { course: { name: t.algorithms.name } },
      },
    });
    expect(body.counts.pending).toBeGreaterThanOrEqual(1);

    const res = await asAdmin(
      `/api/v1/admin/reports/${report!.id}`,
      jsonRequest("PATCH", { status: "resolved" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json<AdminReport>()).toMatchObject({
      status: "resolved",
      submission: { pendingReportCount: 0 },
    });

    expect(
      (
        await asAdmin(
          "/api/v1/admin/reports/999999",
          jsonRequest("PATCH", { status: "dismissed" }),
        )
      ).status,
    ).toBe(404);
  });
});

describe("GET /api/v1/admin/stats", () => {
  it("counts submissions, reports, users and today's uploads", async () => {
    const before = await (
      await asAdmin("/api/v1/admin/stats")
    ).json<AdminStats>();
    await seedProposal();

    const res = await asAdmin("/api/v1/admin/stats");
    const stats = await res.json<AdminStats>();
    expect(stats.submissions.pendingReview).toBe(
      before.submissions.pendingReview + 1,
    );
    expect(stats.submissions.awaitingClassification).toBe(
      before.submissions.awaitingClassification + 1,
    );
    expect(stats.users).toBeGreaterThanOrEqual(2);
    expect(stats.catalog.departments).toBeGreaterThanOrEqual(2);
    expect(stats.dailySubmissions).toHaveLength(30);
    expect(stats.dailySubmissions.at(-1)).toEqual({
      date: new Date().toISOString().slice(0, 10),
      count: before.dailySubmissions.at(-1)!.count + 1,
    });
  });
});
