import { env } from "cloudflare:workers";
import type {
  AdminSubmission,
  AdminSubmissionDetail,
  AdminSubmissionList,
  MySubmissionDetail,
  MySubmissionList,
} from "@ourdiu/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  questions,
  submissionAnalyses,
  submissionMessages,
  submissions,
} from "../src/db/schema";
import {
  api,
  db,
  jsonRequest,
  pdfFile,
  seedQuestion,
  seedSubmission,
  seedTaxonomy,
  signIn,
  signInAdmin,
} from "./helpers";

async function seedPaper(
  status: "pending_review" | "published" | "rejected" | "changes_requested",
) {
  const t = await seedTaxonomy();
  const question = await seedQuestion({
    departmentId: t.cse.id,
    courseId: t.algorithms.id,
    semesterId: t.sem1.id,
    examTypeId: t.midterm.id,
  });
  const uploader = await signIn();
  const paper = await seedSubmission(question.id, {
    uploaderId: uploader.id,
    status,
  });
  await env.BUCKET.put(paper.fileKey, "%PDF-1.7\n%old\n", {
    httpMetadata: { contentType: "application/pdf" },
  });
  return { t, question, uploader, paper };
}

const decide = (id: number, body: unknown, cookie: string) =>
  api(`/api/v1/admin/submissions/${id}`, jsonRequest("PATCH", body, cookie));

const adminWrite = (id: number, body: string, cookie: string) =>
  api(
    `/api/v1/admin/submissions/${id}/messages`,
    jsonRequest("POST", { body }, cookie),
  );

const uploaderWrite = (id: number, body: string, cookie: string) =>
  api(
    `/api/v1/me/submissions/${id}/messages`,
    jsonRequest("POST", { body }, cookie),
  );

const resubmit = (id: number, body: unknown, cookie: string) =>
  api(
    `/api/v1/me/submissions/${id}/resubmit`,
    jsonRequest("POST", body, cookie),
  );

function replaceFile(id: number, file: File, cookie: string) {
  const form = new FormData();
  form.set("file", file);
  return api(`/api/v1/me/submissions/${id}/file`, {
    method: "PUT",
    headers: { cookie },
    body: form,
  });
}

const getMine = (id: number, cookie: string) =>
  api(`/api/v1/me/submissions/${id}`, { headers: { cookie } });

const getAdmin = (id: number, cookie: string) =>
  api(`/api/v1/admin/submissions/${id}`, { headers: { cookie } });

const row = (id: number) =>
  db().query.submissions.findFirst({ where: eq(submissions.id, id) });

describe("asking the uploader for changes", () => {
  it("needs a reason", async () => {
    const admin = await signInAdmin();
    const { paper } = await seedPaper("pending_review");
    const res = await decide(
      paper.id,
      { status: "changes_requested" },
      admin.cookie,
    );
    expect(res.status).toBe(422);
  });

  it("runs the whole loop: request, reply, edit, replace, resubmit, publish", async () => {
    const admin = await signInAdmin();
    const { t, question, uploader, paper } = await seedPaper("pending_review");
    const oldKey = paper.fileKey;

    // The admin asks for changes.
    const asked = await decide(
      paper.id,
      {
        status: "changes_requested",
        reason: "Is this the midterm or the final?",
      },
      admin.cookie,
    );
    expect(asked.status).toBe(200);
    expect(await asked.json<AdminSubmission>()).toMatchObject({
      status: "changes_requested",
      rejectionReason: null,
    });
    // Still on its way in: counted with the papers waiting for review.
    const counted = await db().query.questions.findFirst({
      where: eq(questions.id, question.id),
    });
    expect(counted?.pendingReviewCount).toBe(1);

    // The uploader sees it first in their list, unread, with the request.
    const list = await (
      await api("/api/v1/me/submissions", {
        headers: { cookie: uploader.cookie },
      })
    ).json<MySubmissionList>();
    expect(list.items[0]).toMatchObject({
      id: paper.id,
      status: "changes_requested",
      changesRequested: "Is this the midterm or the final?",
      unread: 1,
    });

    // Opening it shows the conversation without the admin's name, and marks it read.
    const opened = await (
      await getMine(paper.id, uploader.cookie)
    ).json<MySubmissionDetail>();
    expect(opened.unread).toBe(1);
    expect(opened.messages).toEqual([
      expect.objectContaining({
        kind: "changes_requested",
        body: "Is this the midterm or the final?",
        author: { role: "admin", name: null, image: null },
      }),
    ]);
    expect((await row(paper.id))?.uploaderUnread).toBe(0);

    // The uploader replies and fixes the details. Even though they now match the AI,
    // the paper isn't published: the admin wants to see it again.
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
    expect(
      (await uploaderWrite(paper.id, "It's the midterm.", uploader.cookie))
        .status,
    ).toBe(201);
    const edited = await api(
      `/api/v1/me/submissions/${paper.id}/classification`,
      jsonRequest(
        "PUT",
        {
          departmentId: t.cse.id,
          courseId: t.algorithms.id,
          semesterId: t.sem1.id,
          examTypeId: t.midterm.id,
          section: "5A",
        },
        uploader.cookie,
      ),
    );
    expect(edited.status).toBe(200);
    expect(await edited.json<MySubmissionDetail>()).toMatchObject({
      status: "changes_requested",
      section: "5A",
    });

    // And replaces the file: the old one is gone, the new one is checked again.
    const replaced = await replaceFile(
      paper.id,
      new File(["%PDF-1.7\n%new\n"], "new.pdf", { type: "application/pdf" }),
      uploader.cookie,
    );
    expect(replaced.status).toBe(200);
    const after = await row(paper.id);
    expect(after?.fileKey).not.toBe(oldKey);
    expect(await env.BUCKET.get(oldKey)).toBeNull();
    expect(await (await env.BUCKET.get(after!.fileKey))?.text()).toBe(
      "%PDF-1.7\n%new\n",
    );
    const analysis = await db().query.submissionAnalyses.findFirst({
      where: eq(submissionAnalyses.submissionId, paper.id),
    });
    expect(analysis?.autoPublish).toBe(false);

    // Resubmitted with a note: back in the admins' queue, with unread entries.
    const back = await resubmit(
      paper.id,
      { note: "Fixed the section and uploaded a clearer scan." },
      uploader.cookie,
    );
    expect(back.status).toBe(200);
    expect((await back.json<MySubmissionDetail>()).status).toBe(
      "pending_review",
    );
    const queue = await (
      await api(
        "/api/v1/admin/submissions?status=pending_review&pageSize=100",
        {
          headers: { cookie: admin.cookie },
        },
      )
    ).json<AdminSubmissionList>();
    expect(queue.items.find((s) => s.id === paper.id)?.adminUnread).toBe(4);

    // Admins see who wrote what, oldest first.
    const detail = await (
      await getAdmin(paper.id, admin.cookie)
    ).json<AdminSubmissionDetail>();
    expect(detail.messages.map((m) => [m.kind, m.author.role])).toEqual([
      ["changes_requested", "admin"],
      ["comment", "uploader"],
      ["details_edited", "uploader"],
      ["file_replaced", "uploader"],
      ["resubmitted", "uploader"],
    ]);
    expect(detail.messages[0]!.author.name).toBe("Test User");
    expect(detail.messages[4]!.body).toBe(
      "Fixed the section and uploaded a clearer scan.",
    );
    expect((await row(paper.id))?.adminUnread).toBe(0);

    // Published: recorded, and the uploader can't write any more.
    expect(
      (await decide(paper.id, { status: "published" }, admin.cookie)).status,
    ).toBe(200);
    const done = await (
      await getMine(paper.id, uploader.cookie)
    ).json<MySubmissionDetail>();
    expect(done.messages.at(-1)?.kind).toBe("published");
    expect(done.changesRequested).toBeNull();
    expect(
      (await uploaderWrite(paper.id, "Thanks!", uploader.cookie)).status,
    ).toBe(409);
  });

  it("counts papers waiting for changes per status for admins", async () => {
    const admin = await signInAdmin();
    await seedPaper("changes_requested");
    const list = await (
      await api("/api/v1/admin/submissions?status=changes_requested", {
        headers: { cookie: admin.cookie },
      })
    ).json<AdminSubmissionList>();
    expect(list.counts.changesRequested).toBeGreaterThan(0);
    expect(list.items.every((s) => s.status === "changes_requested")).toBe(
      true,
    );
  });
});

describe("the uploader's side", () => {
  it("can only resubmit a paper a reviewer asked to change", async () => {
    const { paper, uploader } = await seedPaper("pending_review");
    expect((await resubmit(paper.id, {}, uploader.cookie)).status).toBe(409);
  });

  it("can't change a rejected or published paper", async () => {
    for (const status of ["rejected", "published"] as const) {
      const { paper, uploader } = await seedPaper(status);
      expect(
        (await replaceFile(paper.id, pdfFile(), uploader.cookie)).status,
      ).toBe(409);
    }
  });

  it("rejects a replacement that isn't a PDF", async () => {
    const { paper, uploader } = await seedPaper("changes_requested");
    const res = await replaceFile(
      paper.id,
      new File(["hello"], "paper.pdf", { type: "application/pdf" }),
      uploader.cookie,
    );
    expect(res.status).toBe(400);
  });

  it("hides other users' papers", async () => {
    const { paper } = await seedPaper("changes_requested");
    const other = await signIn();
    expect((await uploaderWrite(paper.id, "Hi", other.cookie)).status).toBe(
      404,
    );
    expect((await resubmit(paper.id, {}, other.cookie)).status).toBe(404);
    expect((await replaceFile(paper.id, pdfFile(), other.cookie)).status).toBe(
      404,
    );
  });

  it("needs a message to write", async () => {
    const { paper, uploader } = await seedPaper("changes_requested");
    expect((await uploaderWrite(paper.id, "  ", uploader.cookie)).status).toBe(
      422,
    );
  });

  it("loses the conversation when withdrawing the paper", async () => {
    const admin = await signInAdmin();
    const { paper, uploader } = await seedPaper("pending_review");
    await adminWrite(paper.id, "Which section?", admin.cookie);
    const res = await api(`/api/v1/me/submissions/${paper.id}`, {
      method: "DELETE",
      headers: { cookie: uploader.cookie },
    });
    expect(res.status).toBe(204);
    expect(
      await db().query.submissionMessages.findMany({
        where: eq(submissionMessages.submissionId, paper.id),
      }),
    ).toEqual([]);
  });
});

describe("POST /api/v1/admin/submissions/{id}/messages", () => {
  it("lets an admin write in any status, unread for the uploader", async () => {
    const admin = await signInAdmin();
    const { paper, uploader } = await seedPaper("published");
    const res = await adminWrite(paper.id, "Nice scan, thanks!", admin.cookie);
    expect(res.status).toBe(201);
    expect(
      (await res.json<AdminSubmissionDetail>()).messages.at(-1),
    ).toMatchObject({ kind: "comment", author: { role: "admin" } });
    const mine = await (
      await getMine(paper.id, uploader.cookie)
    ).json<MySubmissionDetail>();
    expect(mine.unread).toBe(1);
  });

  it("is for admins only", async () => {
    const { paper, uploader } = await seedPaper("pending_review");
    expect((await adminWrite(paper.id, "Hi", uploader.cookie)).status).toBe(
      403,
    );
  });
});

describe("GET /api/v1/me/review-activity", () => {
  it("counts the papers that need the uploader", async () => {
    const admin = await signInAdmin();
    const { paper, uploader } = await seedPaper("changes_requested");
    const activity = async () =>
      (
        await api("/api/v1/me/review-activity", {
          headers: { cookie: uploader.cookie },
        })
      ).json<{ needsAttention: number }>();
    expect(await activity()).toEqual({ needsAttention: 1 });

    // A message on another paper counts too, until it's read.
    const other = await seedSubmission(paper.questionId!, {
      uploaderId: uploader.id,
      status: "pending_review",
    });
    await adminWrite(other.id, "Which batch?", admin.cookie);
    expect(await activity()).toEqual({ needsAttention: 2 });
    await getMine(other.id, uploader.cookie);
    expect(await activity()).toEqual({ needsAttention: 1 });
  });

  it("requires sign-in", async () => {
    expect((await api("/api/v1/me/review-activity")).status).toBe(401);
  });
});
