import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { emailOutbox, user } from "../src/db/schema";
import { publishIfConfirmed } from "../src/services/analysis";
import {
  MAX_ATTEMPTS,
  renderEmail,
  sendQueuedEmails,
} from "../src/services/email/send";
import {
  api,
  db,
  jsonRequest,
  seedQuestion,
  seedSubmission,
  seedTaxonomy,
  signIn,
  signInAdmin,
} from "./helpers";

async function seedPaper(
  status: "pending_review" | "published" | "changes_requested",
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
  return { t, uploader, paper };
}

const queued = (submissionId: number) =>
  db()
    .select()
    .from(emailOutbox)
    .where(eq(emailOutbox.submissionId, submissionId))
    .orderBy(emailOutbox.id);

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

/** A stand-in for the EMAIL binding that records what it was asked to send. */
function fakeEmail(fail = false) {
  const sent: EmailMessageBuilder[] = [];
  const binding = {
    async send(message: EmailMessageBuilder) {
      if (fail) throw new Error("sending failed");
      sent.push(message);
      return { messageId: crypto.randomUUID() };
    },
  } as unknown as SendEmail;
  return { sent, binding };
}

describe("emails to the uploader", () => {
  it("queues one email for each decision, quoting the reason", async () => {
    const { uploader, paper } = await seedPaper("pending_review");
    const admin = await signInAdmin();

    let res = await decide(
      paper.id,
      { status: "changes_requested", reason: "Upload page 2 too." },
      admin.cookie,
    );
    expect(res.status).toBe(200);
    res = await decide(
      paper.id,
      { status: "rejected", reason: "Not a question paper." },
      admin.cookie,
    );
    expect(res.status).toBe(200);

    const rows = await queued(paper.id);
    expect(rows.map((r) => [r.recipientId, r.kind, r.body])).toEqual([
      [uploader.id, "changes_requested", "Upload page 2 too."],
      [uploader.id, "rejected", "Not a question paper."],
    ]);
  });

  it("emails once for a run of reviewer messages, again after they're read", async () => {
    const { uploader, paper } = await seedPaper("pending_review");
    const admin = await signInAdmin();

    await adminWrite(paper.id, "Is this the 2024 paper?", admin.cookie);
    await adminWrite(paper.id, "Also, the second page?", admin.cookie);
    expect(await queued(paper.id)).toHaveLength(1);

    // Opening the paper reads the conversation.
    const opened = await api(`/api/v1/me/submissions/${paper.id}`, {
      headers: { cookie: uploader.cookie },
    });
    expect(opened.status).toBe(200);
    await adminWrite(paper.id, "Any news?", admin.cookie);

    const rows = await queued(paper.id);
    expect(rows.map((r) => [r.kind, r.body])).toEqual([
      ["admin_message", "Is this the 2024 paper?"],
      ["admin_message", "Any news?"],
    ]);
  });

  it("emails when the AI check publishes the paper", async () => {
    const { t, paper } = await seedPaper("pending_review");
    const values = {
      department: { id: t.cse.id, name: t.cse.name },
      course: { id: t.algorithms.id, name: t.algorithms.name },
      semester: { id: t.sem1.id, name: t.sem1.name },
      examType: { id: t.midterm.id, name: t.midterm.name },
    };
    const published = await publishIfConfirmed(
      db(),
      env.WATERMARK_QUEUE,
      paper.id,
      { isQuestionPaper: true, paperCount: 1 },
      values as never,
    );
    expect(published).toBe(true);
    expect((await queued(paper.id)).map((r) => r.kind)).toEqual(["published"]);
  });

  it("doesn't email an admin about their own paper", async () => {
    const t = await seedTaxonomy();
    const question = await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    });
    const admin = await signInAdmin();
    const paper = await seedSubmission(question.id, {
      uploaderId: admin.id,
      status: "pending_review",
    });
    await decide(paper.id, { status: "published" }, admin.cookie);
    expect(await queued(paper.id)).toEqual([]);
  });
});

describe("emails to admins", () => {
  it("emails every other admin when the uploader first replies", async () => {
    const { uploader, paper } = await seedPaper("changes_requested");
    const admin = await signInAdmin();

    await uploaderWrite(paper.id, "Fixed the course.", uploader.cookie);
    await uploaderWrite(paper.id, "And the semester.", uploader.cookie);

    const rows = await queued(paper.id);
    const mine = rows.filter((r) => r.recipientId === admin.id);
    expect(mine.map((r) => [r.kind, r.body])).toEqual([
      ["uploader_update", "Fixed the course."],
    ]);
    expect(rows.every((r) => r.recipientId !== uploader.id)).toBe(true);
  });

  it("emails on a paper's first open report only", async () => {
    const { paper } = await seedPaper("published");
    const admin = await signInAdmin();
    const report = (cookie: string) =>
      api(
        `/api/v1/submissions/${paper.id}/reports`,
        jsonRequest(
          "POST",
          { reason: "wrong_file", details: "It's a lab sheet." },
          cookie,
        ),
      );

    expect((await report((await signIn()).cookie)).status).toBe(201);
    expect((await report((await signIn()).cookie)).status).toBe(201);

    const mine = (await queued(paper.id)).filter(
      (r) => r.recipientId === admin.id,
    );
    expect(mine.map((r) => [r.kind, r.body])).toEqual([
      ["report", "wrong_file\nIt's a lab sheet."],
    ]);
  });
});

describe("sendQueuedEmails", () => {
  it("sends and deletes queued emails, skipping people who turned them off", async () => {
    const { uploader, paper } = await seedPaper("pending_review");
    const admin = await signInAdmin();
    await decide(
      paper.id,
      { status: "changes_requested", reason: "Upload page 2 too." },
      admin.cookie,
    );
    await adminWrite(paper.id, "Thanks!", admin.cookie);

    const other = await seedPaper("pending_review");
    await db()
      .update(user)
      .set({ emailNotifications: false })
      .where(eq(user.id, other.uploader.id));
    await adminWrite(other.paper.id, "Hello?", admin.cookie);

    const { sent, binding } = fakeEmail();
    await sendQueuedEmails(db(), { EMAIL: binding, SITE_URL: env.SITE_URL });

    const toUploader = sent.filter(
      (m) => (m.to as EmailAddress).email === uploader.email,
    );
    expect(toUploader).toHaveLength(1);
    expect(toUploader[0]!.from).toEqual({
      email: "noreply@ourdiu.com",
      name: "OurDIU",
    });
    expect(toUploader[0]!.subject).toMatch(/^Changes needed: Algorithms /);
    expect(toUploader[0]!.text).toContain("Upload page 2 too.");
    expect(toUploader[0]!.text).toContain(
      `/questions/my-submissions/${paper.id}`,
    );
    expect(
      sent.some((m) => (m.to as EmailAddress).email === other.uploader.email),
    ).toBe(false);
    expect(await queued(paper.id)).toEqual([]);
    expect(await queued(other.paper.id)).toEqual([]);
  });

  it("keeps a failed email for another try, then drops it", async () => {
    const { paper } = await seedPaper("pending_review");
    const admin = await signInAdmin();
    await adminWrite(paper.id, "Hi", admin.cookie);

    const { binding } = fakeEmail(true);
    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
      await sendQueuedEmails(db(), { EMAIL: binding, SITE_URL: env.SITE_URL });
      expect((await queued(paper.id))[0]?.attempts).toBe(attempt);
    }
    await sendQueuedEmails(db(), { EMAIL: binding, SITE_URL: env.SITE_URL });
    expect(await queued(paper.id)).toEqual([]);
  });
});

describe("renderEmail", () => {
  it("escapes the quoted text in HTML and links to account settings", () => {
    const email = renderEmail(
      {
        kind: "admin_message",
        submissionId: 7,
        body: "<b>hi</b>",
        name: "Rahim",
        course: "Algorithms",
        examType: "Final",
      },
      "https://ourdiu.com",
    );
    expect(email.subject).toBe("A reviewer wrote about Algorithms (Final)");
    expect(email.html).toContain("&lt;b&gt;hi&lt;/b&gt;");
    expect(email.html).not.toContain("<b>hi</b>");
    expect(email.text).toContain("https://ourdiu.com/account");
  });
});

describe("PUT /api/v1/me/email-notifications", () => {
  it("turns emails off and on, and the profile shows it", async () => {
    const me = await signIn();
    const put = (emailNotifications: unknown) =>
      api(
        "/api/v1/me/email-notifications",
        jsonRequest("PUT", { emailNotifications }, me.cookie),
      );
    const profile = async () =>
      (await (
        await api("/api/v1/me", { headers: { cookie: me.cookie } })
      ).json()) as { emailNotifications: boolean };

    expect((await profile()).emailNotifications).toBe(true);
    const res = await put(false);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ emailNotifications: false });
    expect((await profile()).emailNotifications).toBe(false);
    expect((await put(true)).status).toBe(200);
    expect((await profile()).emailNotifications).toBe(true);
    expect((await put("no")).status).toBe(422);
  });

  it("needs a session", async () => {
    const res = await api(
      "/api/v1/me/email-notifications",
      jsonRequest("PUT", { emailNotifications: false }),
    );
    expect(res.status).toBe(401);
  });
});
