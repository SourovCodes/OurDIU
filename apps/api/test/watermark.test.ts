import { env } from "cloudflare:workers";
import type {
  AdminSubmissionDetail,
  QuestionDetail,
  SubmissionWatermark,
} from "@ourdiu/shared";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { inList } from "../src/db/in-list";
import { submissions, type NewSubmissionRow } from "../src/db/schema";
import { publishIfConfirmed } from "../src/services/analysis";
import { updateSubmissionStatus } from "../src/services/moderation";
import { getQuestion } from "../src/services/questions";
import {
  enqueueWatermarks,
  creditText,
  rewatermarkAll,
  runWatermark,
  stampText,
  watermarkMissing,
  WATERMARK_MAX_ATTEMPTS,
  type WatermarkEnv,
  type WatermarkJob,
} from "../src/services/watermark";
import {
  api,
  db,
  seedQuestion,
  seedTaxonomy,
  seedUser,
  signInAdmin,
  signIn,
} from "./helpers";

type Taxonomy = Awaited<ReturnType<typeof seedTaxonomy>>;

let admin: Awaited<ReturnType<typeof signInAdmin>>;
let member: Awaited<ReturnType<typeof signIn>>;
let t: Taxonomy;
let questionId: number;

beforeAll(async () => {
  [admin, member, t] = await Promise.all([
    signInAdmin(),
    signIn(),
    seedTaxonomy(),
  ]);
  questionId = (
    await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    })
  ).id;
  PAPER_NAME = `${t.algorithms.name} - ${t.midterm.name} - ${t.sem1.name}.pdf`;
});

/** The test question's papers save as "<course> - <exam type> - <semester>.pdf". */
let PAPER_NAME: string;

const ORIGINAL = "%PDF-1.7\noriginal" + "x".repeat(1000);
const WATERMARKED = "%PDF-1.7\nwatermarked";

/** A paper filed under the test question, with its original PDF in R2. */
async function seedPaper(overrides: Partial<NewSubmissionRow> = {}) {
  const id = crypto.randomUUID();
  const fileKey = `submissions/${id}.pdf`;
  await env.BUCKET.put(fileKey, ORIGINAL, {
    httpMetadata: { contentType: "application/pdf" },
  });
  const [row] = await db()
    .insert(submissions)
    .values({
      questionId,
      status: "published",
      fileKey,
      fileSize: ORIGINAL.length,
      uploaderId: member.id,
      ...overrides,
    })
    .returning();
  return row!;
}

/** A PDF response's body as text (`.text()` warns on non-text content types). */
const pdfText = async (res: Response) =>
  new TextDecoder().decode(await res.arrayBuffer());

const readRow = async (id: number) =>
  (await db().query.submissions.findFirst({ where: eq(submissions.id, id) }))!;

/** Collects sent messages instead of queueing them. */
function fakeQueue(failing = false) {
  const sent: WatermarkJob[] = [];
  const queue = {
    sendBatch: async (messages: { body: WatermarkJob }[]) => {
      if (failing) throw new Error("queue down");
      sent.push(...messages.map((m) => m.body));
    },
  } as unknown as Queue<WatermarkJob>;
  return { queue, sent };
}

const watermarkEnv = {
  BUCKET: env.BUCKET,
  COMPRESSOR_API_KEY: "processor-test-key",
  PDF_PROCESSOR_URL: "https://pdf-processor.test",
  SITE_URL: "https://diuqbank.com",
} satisfies WatermarkEnv;

const SITE = "https://diuqbank.com/";

/** Answers the PDF processor and records the watermark requests. */
function fakeProcessor(respond?: () => Response) {
  const calls: {
    apiKey: string | null;
    credit: string;
    stamp: string;
    pdf: string;
  }[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (
      url !== "https://pdf-processor.test/api/pdfs/credit-watermark-compress"
    ) {
      throw new Error(`Unexpected fetch: ${url}`);
    }
    const form = init!.body as FormData;
    calls.push({
      apiKey: new Headers(init!.headers).get("x-api-key"),
      credit: String(form.get("credit_text")),
      stamp: String(form.get("watermark_text")),
      pdf: await (form.get("pdf") as File).text(),
    });
    return (
      respond?.() ??
      new Response(WATERMARKED, {
        headers: { "content-type": "application/pdf" },
      })
    );
  }) as typeof fetch;
  return { fetch: fetcher, calls };
}

describe("creditText", () => {
  it("credits the site and the contributor", () => {
    expect(creditText(SITE, "Jane  Doe ")).toBe(
      "diuqbank.com | Shared by Jane Doe",
    );
  });

  it("credits only the site without a contributor", () => {
    expect(creditText(SITE, null)).toBe("Downloaded from diuqbank.com");
    expect(creditText(SITE, "  ")).toBe("Downloaded from diuqbank.com");
  });

  it("stays within the processor's 255 characters", () => {
    const text = creditText(SITE, "n".repeat(400));
    expect(text).toHaveLength(255);
    expect(text.endsWith("...")).toBe(true);
  });

  it("keeps to ASCII, which the processor's font can draw", () => {
    expect(creditText(SITE, "José Núñez")).toBe(
      "diuqbank.com | Shared by Jose Nunez",
    );
    expect(creditText(SITE, "সৌরভ বিশ্বাস")).toBe(
      "Downloaded from diuqbank.com",
    );
  });
});

describe("stampText", () => {
  it("stamps the site's domain", () => {
    expect(stampText(SITE)).toBe("diuqbank.com");
    expect(stampText("https://ourdiu.com")).toBe("ourdiu.com");
  });
});

describe("queueing on publish", () => {
  it("queues a paper an admin publishes", async () => {
    const paper = await seedPaper({ status: "pending_review" });
    const { queue, sent } = fakeQueue();
    const result = await updateSubmissionStatus(
      db(),
      queue,
      null,
      paper.id,
      "published",
    );
    expect(sent).toEqual([{ submissionId: paper.id }]);
    expect(result.watermark).toEqual({
      status: "queued",
      error: null,
      fileSize: null,
    });
  });

  it("doesn't queue a paper again that already has its copy", async () => {
    const paper = await seedPaper({
      status: "pending_review",
      watermarkStatus: "done",
      watermarkedFileKey: `watermarked/${crypto.randomUUID()}.pdf`,
    });
    const { queue, sent } = fakeQueue();
    await updateSubmissionStatus(db(), queue, null, paper.id, "published");
    expect(sent).toEqual([]);
  });

  it("doesn't queue rejections", async () => {
    const paper = await seedPaper({ status: "pending_review" });
    const { queue, sent } = fakeQueue();
    await updateSubmissionStatus(
      db(),
      queue,
      null,
      paper.id,
      "rejected",
      "No.",
    );
    expect(sent).toEqual([]);
    expect((await readRow(paper.id)).watermarkStatus).toBeNull();
  });

  it("queues a paper the AI check publishes", async () => {
    const paper = await seedPaper({ status: "pending_review" });
    const { queue, sent } = fakeQueue();
    const value = <T extends { id: number; name: string }>(v: T) => ({
      id: v.id,
      name: v.name,
    });
    const published = await publishIfConfirmed(
      db(),
      queue,
      paper.id,
      { isQuestionPaper: true, paperCount: 1 },
      {
        department: { ...value(t.cse), shortName: t.cse.shortName },
        course: value(t.algorithms),
        semester: value(t.sem1),
        examType: value(t.midterm),
        section: null,
        batch: null,
      },
    );
    expect(published).toBe(true);
    expect(sent).toEqual([{ submissionId: paper.id }]);
  });

  it("marks the paper failed when the queue is down, and still publishes", async () => {
    const paper = await seedPaper({ status: "pending_review" });
    const { queue } = fakeQueue(true);
    const result = await updateSubmissionStatus(
      db(),
      queue,
      null,
      paper.id,
      "published",
    );
    expect(result.status).toBe("published");
    expect(result.watermark?.status).toBe("failed");
  });
});

describe("runWatermark", () => {
  it("stores the watermarked copy next to the untouched original", async () => {
    const paper = await seedPaper();
    await enqueueWatermarks(db(), fakeQueue().queue, [paper.id]);
    const processor = fakeProcessor();

    const outcome = await runWatermark(
      db(),
      watermarkEnv,
      { submissionId: paper.id },
      { fetch: processor.fetch },
    );

    expect(outcome).toBe("done");
    expect(processor.calls).toEqual([
      {
        apiKey: "processor-test-key",
        credit: "diuqbank.com | Shared by Test User",
        stamp: "diuqbank.com",
        pdf: ORIGINAL,
      },
    ]);
    const row = await readRow(paper.id);
    expect(row).toMatchObject({
      watermarkStatus: "done",
      watermarkError: null,
      // Random, not derived from the id: the bucket is public.
      watermarkedFileKey: expect.stringMatching(
        /^watermarked\/[0-9a-f-]{36}\.pdf$/,
      ),
      watermarkedFileSize: WATERMARKED.length,
    });
    const copy = await env.BUCKET.get(row!.watermarkedFileKey!);
    expect(await copy!.text()).toBe(WATERMARKED);
    expect(copy!.httpMetadata?.contentType).toBe("application/pdf");
    // Saved under the paper's name, not the random key.
    expect(copy!.httpMetadata?.contentDisposition).toBe(
      `inline; filename="${PAPER_NAME}"; filename*=UTF-8''${encodeURIComponent(PAPER_NAME)}`,
    );
    expect(await (await env.BUCKET.get(paper.fileKey))!.text()).toBe(ORIGINAL);
  });

  it("credits only the site when the uploader is gone", async () => {
    const paper = await seedPaper({ uploaderId: null });
    const processor = fakeProcessor();
    await runWatermark(
      db(),
      watermarkEnv,
      { submissionId: paper.id },
      { fetch: processor.fetch },
    );
    expect(processor.calls[0]!.credit).toBe("Downloaded from diuqbank.com");
  });

  it("retries server errors, then gives up after the last attempt", async () => {
    const paper = await seedPaper();
    await enqueueWatermarks(db(), fakeQueue().queue, [paper.id]);
    const processor = fakeProcessor(
      () => new Response("boom", { status: 500 }),
    );
    const run = (attempt: number) =>
      runWatermark(
        db(),
        watermarkEnv,
        { submissionId: paper.id },
        { attempt, fetch: processor.fetch },
      );

    expect(await run(1)).toBe("retry");
    expect((await readRow(paper.id)).watermarkStatus).toBe("queued");

    expect(await run(WATERMARK_MAX_ATTEMPTS)).toBe("done");
    const row = await readRow(paper.id);
    expect(row.watermarkStatus).toBe("failed");
    expect(row.watermarkError).toContain("500");
    expect(row.watermarkedFileKey).toBeNull();
  });

  it("doesn't retry a PDF the processor rejects", async () => {
    const paper = await seedPaper();
    const processor = fakeProcessor(() =>
      Response.json({ message: "Not a valid PDF" }, { status: 422 }),
    );
    const outcome = await runWatermark(
      db(),
      watermarkEnv,
      { submissionId: paper.id },
      { fetch: processor.fetch },
    );
    expect(outcome).toBe("done");
    const row = await readRow(paper.id);
    expect(row.watermarkStatus).toBe("failed");
    expect(row.watermarkError).toContain("Not a valid PDF");
  });

  it("fails without calling out when no API key is configured", async () => {
    const paper = await seedPaper();
    const processor = fakeProcessor();
    await runWatermark(
      db(),
      { ...watermarkEnv, COMPRESSOR_API_KEY: "" },
      { submissionId: paper.id },
      { fetch: processor.fetch },
    );
    expect(processor.calls).toEqual([]);
    expect((await readRow(paper.id)).watermarkStatus).toBe("failed");
  });

  it("ignores deleted submissions", async () => {
    const processor = fakeProcessor();
    const outcome = await runWatermark(
      db(),
      watermarkEnv,
      { submissionId: 999_999 },
      { fetch: processor.fetch },
    );
    expect(outcome).toBe("done");
    expect(processor.calls).toEqual([]);
  });
});

/** A published paper whose watermarked copy is done. */
async function seedWatermarkedPaper(overrides: Partial<NewSubmissionRow> = {}) {
  const paper = await seedPaper(overrides);
  await runWatermark(
    db(),
    watermarkEnv,
    { submissionId: paper.id },
    { fetch: fakeProcessor().fetch },
  );
  const { watermarkedFileKey } = (await readRow(paper.id))!;
  return { ...paper, watermarkedFileKey: watermarkedFileKey! };
}

describe("serving", () => {
  it("links a published paper to its copy on the public files domain", async () => {
    const [copy, original, pending] = await Promise.all([
      seedWatermarkedPaper(),
      seedPaper(),
      seedPaper({ status: "pending_review" }),
    ]);
    const urls = async (filesUrl: string) => {
      const question = (await getQuestion(db(), questionId, filesUrl))!;
      const byId = new Map(question.submissions.map((s) => [s.id, s.fileUrl]));
      return [copy, original, pending].map((paper) => byId.get(paper.id));
    };
    expect(await urls("https://files.test")).toEqual([
      `https://files.test/${copy.watermarkedFileKey}`,
      // No copy yet: the API serves the original.
      `/api/v1/submissions/${original.id}/file`,
      null,
    ]);
    // Without a files domain (local dev), everything goes through the API.
    expect((await urls(""))[0]).toBe(`/api/v1/submissions/${copy.id}/file`);
  });

  it("gives the public the watermarked copy, cached for a day", async () => {
    const paper = await seedWatermarkedPaper();
    const res = await api(`/api/v1/submissions/${paper.id}/file`);
    expect(res.status).toBe(200);
    expect(await pdfText(res)).toBe(WATERMARKED);
    expect(res.headers.get("cache-control")).toBe("public, max-age=86400");
    expect(res.headers.get("content-disposition")).toContain(
      `filename="${PAPER_NAME}"`,
    );
  });

  it("gives the public the original, briefly cached, until the copy is ready", async () => {
    const paper = await seedPaper();
    const res = await api(`/api/v1/submissions/${paper.id}/file`);
    expect(res.status).toBe(200);
    expect(await pdfText(res)).toBe(ORIGINAL);
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
    expect(res.headers.get("content-disposition")).toContain(
      `filename="${PAPER_NAME}"`,
    );
  });

  it("gives admins and the uploader the original", async () => {
    const paper = await seedWatermarkedPaper();
    const asAdmin = await api(`/api/v1/admin/submissions/${paper.id}/file`, {
      headers: { cookie: admin.cookie },
    });
    expect(await pdfText(asAdmin)).toBe(ORIGINAL);
    const asUploader = await api(`/api/v1/me/submissions/${paper.id}/file`, {
      headers: { cookie: member.cookie },
    });
    expect(await pdfText(asUploader)).toBe(ORIGINAL);
  });

  it("shows the public the size of the copy it downloads", async () => {
    const paper = await seedWatermarkedPaper();
    const res = await api(`/api/v1/questions/${questionId}`);
    const question = await res.json<QuestionDetail>();
    expect(question.submissions.find((s) => s.id === paper.id)?.fileSize).toBe(
      WATERMARKED.length,
    );
  });

  it("shows admins the watermark state", async () => {
    const paper = await seedWatermarkedPaper();
    const res = await api(`/api/v1/admin/submissions/${paper.id}`, {
      headers: { cookie: admin.cookie },
    });
    const detail = await res.json<AdminSubmissionDetail>();
    expect(detail.fileSize).toBe(ORIGINAL.length);
    expect(detail.watermark).toEqual({
      status: "done",
      error: null,
      fileSize: WATERMARKED.length,
    });
  });
});

describe("deleting", () => {
  it("removes both files when an admin deletes a paper", async () => {
    const paper = await seedWatermarkedPaper();
    const res = await api(`/api/v1/admin/submissions/${paper.id}`, {
      method: "DELETE",
      headers: { cookie: admin.cookie },
    });
    expect(res.status).toBe(204);
    expect(await env.BUCKET.head(paper.fileKey)).toBeNull();
    expect(await env.BUCKET.head(paper.watermarkedFileKey)).toBeNull();
  });

  it("removes both files when the uploader withdraws a hidden paper", async () => {
    const paper = await seedWatermarkedPaper();
    await db()
      .update(submissions)
      .set({ status: "pending_review" })
      .where(eq(submissions.id, paper.id));
    const res = await api(`/api/v1/me/submissions/${paper.id}`, {
      method: "DELETE",
      headers: { cookie: member.cookie },
    });
    expect(res.status).toBe(204);
    expect(await env.BUCKET.head(paper.fileKey)).toBeNull();
    expect(await env.BUCKET.head(paper.watermarkedFileKey)).toBeNull();
  });
});

describe("admin endpoints", () => {
  it("queues only published papers without a copy", async () => {
    const [missing, failed, done, pending] = await Promise.all([
      seedPaper(),
      seedPaper({ watermarkStatus: "failed", watermarkError: "boom" }),
      seedWatermarkedPaper(),
      seedPaper({ status: "pending_review" }),
    ]);
    const { queue, sent } = fakeQueue();
    const queued = await watermarkMissing(db(), queue);
    const ids = sent.map((job) => job.submissionId);
    expect(ids).toEqual(expect.arrayContaining([missing.id, failed.id]));
    expect(ids).not.toContain(done.id);
    expect(ids).not.toContain(pending.id);
    expect(queued).toBe(sent.length);
  });

  it("queues more papers than one D1 query can bind", async () => {
    const papers = await Promise.all(
      Array.from({ length: 150 }, () => seedPaper()),
    );
    const { queue, sent } = fakeQueue();
    await watermarkMissing(db(), queue);
    const ids = new Set(sent.map((job) => job.submissionId));
    expect(papers.every((paper) => ids.has(paper.id))).toBe(true);
    const rows = await db().query.submissions.findMany({
      columns: { watermarkStatus: true },
      where: inList(
        submissions.id,
        papers.map((paper) => paper.id),
      ),
    });
    expect(rows.every((row) => row.watermarkStatus === "queued")).toBe(true);
  });

  it("backfills through the API, for admins only", async () => {
    const paper = await seedPaper();
    const denied = await api("/api/v1/admin/submissions/watermark", {
      method: "POST",
      headers: { cookie: member.cookie },
    });
    expect(denied.status).toBe(403);

    const res = await api("/api/v1/admin/submissions/watermark", {
      method: "POST",
      headers: { cookie: admin.cookie },
    });
    expect(res.status).toBe(202);
    const body = await res.json<{ queued: number }>();
    expect(body.queued).toBeGreaterThanOrEqual(1);
    expect((await readRow(paper.id)).watermarkStatus).not.toBeNull();
  });

  it("queues every published paper again, with or without a copy", async () => {
    const [missing, done, pending] = await Promise.all([
      seedPaper(),
      seedWatermarkedPaper(),
      seedPaper({ status: "pending_review" }),
    ]);
    const { queue, sent } = fakeQueue();
    const queued = await rewatermarkAll(db(), queue);
    const ids = sent.map((job) => job.submissionId);
    expect(ids).toEqual(expect.arrayContaining([missing.id, done.id]));
    expect(ids).not.toContain(pending.id);
    expect(queued).toBe(sent.length);
  });

  it("redoes every copy through the API, for admins only", async () => {
    const paper = await seedWatermarkedPaper();
    const denied = await api("/api/v1/admin/submissions/watermark/all", {
      method: "POST",
      headers: { cookie: member.cookie },
    });
    expect(denied.status).toBe(403);

    const res = await api("/api/v1/admin/submissions/watermark/all", {
      method: "POST",
      headers: { cookie: admin.cookie },
    });
    expect(res.status).toBe(202);
    const body = await res.json<{ queued: number }>();
    expect(body.queued).toBeGreaterThanOrEqual(1);
    expect((await readRow(paper.id)).watermarkStatus).toBe("queued");
    // The current copy keeps being served meanwhile.
    const file = await api(`/api/v1/submissions/${paper.id}/file`);
    expect(await pdfText(file)).toBe(WATERMARKED);
  });

  it("makes a published paper's copy again", async () => {
    const paper = await seedWatermarkedPaper();
    const res = await api(`/api/v1/admin/submissions/${paper.id}/watermark`, {
      method: "POST",
      headers: { cookie: admin.cookie },
    });
    expect(res.status).toBe(202);
    const watermark = await res.json<SubmissionWatermark>();
    expect(watermark.fileSize).toBe(WATERMARKED.length);
    // The current copy keeps being served meanwhile.
    const file = await api(`/api/v1/submissions/${paper.id}/file`);
    expect(await pdfText(file)).toBe(WATERMARKED);
  });

  it("replaces the old copy when it's made again", async () => {
    const paper = await seedWatermarkedPaper();
    await runWatermark(
      db(),
      watermarkEnv,
      { submissionId: paper.id },
      { fetch: fakeProcessor().fetch },
    );
    const { watermarkedFileKey } = await readRow(paper.id);
    expect(watermarkedFileKey).not.toBe(paper.watermarkedFileKey);
    expect(await env.BUCKET.head(watermarkedFileKey!)).not.toBeNull();
    expect(await env.BUCKET.head(paper.watermarkedFileKey)).toBeNull();
  });

  it("refuses to watermark unpublished or missing papers", async () => {
    const pending = await seedPaper({ status: "pending_review" });
    const conflict = await api(
      `/api/v1/admin/submissions/${pending.id}/watermark`,
      { method: "POST", headers: { cookie: admin.cookie } },
    );
    expect(conflict.status).toBe(409);
    const missing = await api("/api/v1/admin/submissions/999999/watermark", {
      method: "POST",
      headers: { cookie: admin.cookie },
    });
    expect(missing.status).toBe(404);
  });

  it("uses a seeded uploader's name", async () => {
    const uploader = await seedUser("Ada Lovelace");
    const paper = await seedPaper({ uploaderId: uploader.id });
    const processor = fakeProcessor();
    await runWatermark(
      db(),
      watermarkEnv,
      { submissionId: paper.id },
      { fetch: processor.fetch },
    );
    expect(processor.calls[0]!.credit).toBe(
      "diuqbank.com | Shared by Ada Lovelace",
    );
  });
});
