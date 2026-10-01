import { env } from "cloudflare:workers";
import type {
  AdminSubmissionDetail,
  AdminSubmissionList,
  SubmissionAnalysis,
} from "@ourdiu/shared";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import {
  questions,
  submissionAnalyses,
  submissionReports,
  submissions,
  type NewSubmissionRow,
} from "../src/db/schema";
import {
  ANALYSIS_MAX_ATTEMPTS,
  buildPrompt,
  checkUnchecked,
  enqueueAnalysis,
  matchToCatalog,
  runAnalysis,
  type AnalysisEnv,
  type AnalysisJob,
  type AnalysisReply,
  type Catalog,
} from "../src/services/analysis";
import {
  api,
  db,
  jsonRequest,
  pdfFile,
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

/** A pending proposal (new course and semester) with its PDF in R2. */
async function seedPaper(overrides: Partial<NewSubmissionRow> = {}) {
  const id = crypto.randomUUID();
  const fileKey = `submissions/${id}.pdf`;
  await env.BUCKET.put(fileKey, "%PDF-1.7\n" + "x".repeat(1000));
  const [row] = await db()
    .insert(submissions)
    .values({
      status: "pending_review",
      fileKey,
      fileSize: 1009,
      uploaderId: member.id,
      departmentId: t.cse.id,
      customCourseName: `Compilers ${id.slice(0, 6)}`,
      customSemesterName: "Short 18",
      examTypeId: t.final.id,
      ...overrides,
    })
    .returning();
  return row!;
}

/** Collects sent messages instead of queueing them. */
function fakeQueue(failing = false) {
  const sent: AnalysisJob[] = [];
  const queue = {
    send: async (job: AnalysisJob) => {
      if (failing) throw new Error("queue down");
      sent.push(job);
    },
  } as unknown as Queue<AnalysisJob>;
  return { queue, sent };
}

const analysisEnv = {
  ...env,
  GEMINI_API_KEY: "gemini-test-key",
  COMPRESSOR_API_KEY: "compressor-test-key",
  PDF_PROCESSOR_URL: "https://pdf-processor.test",
  GEMINI_MODEL: "gemini-test",
} satisfies AnalysisEnv;

const geminiReply = (reply: unknown) =>
  Response.json({
    candidates: [
      {
        content: { parts: [{ text: JSON.stringify(reply) }] },
        finishReason: "STOP",
      },
    ],
  });

/** Answers the compressor and Gemini, and records what Gemini was sent. */
function fakeFetch(options: {
  reply: unknown;
  compressor?: () => Response;
  gemini?: () => Response;
}) {
  const calls: { url: string; body?: string }[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({
      url,
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    if (url.startsWith("https://pdf-processor.test/api/pdfs/compress")) {
      return (
        options.compressor?.() ??
        new Response("%PDF-1.7\nsmall", {
          headers: { "content-type": "application/pdf" },
        })
      );
    }
    if (url.includes("generativelanguage.googleapis.com")) {
      return options.gemini?.() ?? geminiReply(options.reply);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;
  return { fetch: fetcher, calls };
}

async function startRun(submissionId: number, autoPublish = false) {
  const { queue, sent } = fakeQueue();
  await enqueueAnalysis(db(), queue, submissionId, { autoPublish });
  return sent[0]!;
}

const analysisRow = (submissionId: number) =>
  db().query.submissionAnalyses.findFirst({
    where: eq(submissionAnalyses.submissionId, submissionId),
  });

const catalog = (): Catalog => ({
  departments: [t.cse, t.eee],
  courses: [t.algorithms, t.circuits],
  semesters: [t.sem1, t.sem2],
  examTypes: [t.midterm, t.final],
});

const baseReply: AnalysisReply = {
  isQuestionPaper: true,
  paperCount: 1,
  note: "One midterm paper.",
  department: null,
  course: null,
  semester: null,
  examType: null,
  section: null,
  batch: null,
};

describe("matchToCatalog", () => {
  it("keeps valid ids and uses the catalog's names", () => {
    expect(
      matchToCatalog(
        {
          ...baseReply,
          department: { existingId: t.cse.id, name: "CSE", shortName: null },
          course: { existingId: t.algorithms.id, name: "algorithms" },
          semester: { existingId: t.sem2.id, name: "x" },
          examType: { existingId: t.midterm.id, name: "Mid" },
          section: " A ",
          batch: "61",
        },
        catalog(),
      ),
    ).toEqual({
      department: {
        id: t.cse.id,
        name: t.cse.name,
        shortName: t.cse.shortName,
      },
      course: { id: t.algorithms.id, name: t.algorithms.name },
      semester: { id: t.sem2.id, name: t.sem2.name },
      examType: { id: t.midterm.id, name: t.midterm.name },
      section: "A",
      batch: "61",
    });
  });

  it("matches names and short names, and standardizes new names", () => {
    const values = matchToCatalog(
      {
        ...baseReply,
        // Only the abbreviation, with a made-up id.
        department: {
          existingId: 9999,
          name: t.cse.shortName,
          shortName: null,
        },
        course: { existingId: null, name: t.algorithms.name.toUpperCase() },
        semester: { existingId: null, name: "spring 2025" },
        examType: { existingId: null, name: "Quiz & Viva" },
        section: "far too long for a section",
      },
      catalog(),
    );
    expect(values).toMatchObject({
      department: { id: t.cse.id },
      course: { id: t.algorithms.id },
      semester: { id: null, name: "Spring 25" },
      examType: { id: null, name: "Quiz and Viva" },
      section: null,
    });
  });

  it("only matches courses within the department", () => {
    const values = matchToCatalog(
      {
        ...baseReply,
        department: {
          existingId: null,
          name: "Mechanical & Production Engineering",
          shortName: "MPE",
        },
        // Belongs to CSE, so it's new under the new department.
        course: { existingId: t.algorithms.id, name: t.algorithms.name },
      },
      catalog(),
    );
    expect(values.department).toEqual({
      id: null,
      name: "Mechanical and Production Engineering",
      shortName: "MPE",
    });
    expect(values.course).toEqual({ id: null, name: t.algorithms.name });
  });

  it("drops semesters that aren't in the semester format", () => {
    const values = matchToCatalog(
      { ...baseReply, semester: { existingId: null, name: "2nd Semester" } },
      catalog(),
    );
    expect(values.semester).toBeNull();
  });
});

describe("buildPrompt", () => {
  it("lists the catalog with ids and asks for full department names", () => {
    const prompt = buildPrompt(catalog());
    expect(prompt).toContain(`"id":${t.cse.id}`);
    expect(prompt).toContain(t.algorithms.name);
    expect(prompt).toContain("never an abbreviation");
  });
});

describe("runAnalysis", () => {
  it("compresses the PDF, asks Gemini once and stores the matched answer", async () => {
    const paper = await seedPaper();
    const job = await startRun(paper.id);
    expect((await analysisRow(paper.id))?.status).toBe("queued");

    const { fetch, calls } = fakeFetch({
      reply: {
        ...baseReply,
        department: {
          existingId: null,
          name: t.cse.shortName,
          shortName: t.cse.shortName,
        },
        course: { existingId: null, name: "Compiler Design & Construction" },
        semester: { existingId: t.sem1.id, name: t.sem1.name },
        examType: { existingId: t.midterm.id, name: t.midterm.name },
        batch: "61",
      },
    });

    expect(await runAnalysis(db(), analysisEnv, job, { fetch })).toBe("done");

    const gemini = calls.filter((c) => c.url.includes("generativelanguage"));
    expect(gemini).toHaveLength(1);
    expect(gemini[0]!.url).toContain("/models/gemini-test:generateContent");
    // The compressed PDF is what Gemini gets.
    const sent = JSON.parse(gemini[0]!.body!);
    expect(
      atob(sent.contents[0].parts[0].inline_data.data).startsWith(
        "%PDF-1.7\nsmall",
      ),
    ).toBe(true);

    const row = await analysisRow(paper.id);
    expect(row).toMatchObject({
      status: "completed",
      error: null,
      model: "gemini-test",
      attempts: 1,
      originalBytes: 1009,
      sentBytes: 14,
      isQuestionPaper: true,
      paperCount: 1,
      departmentId: t.cse.id,
      departmentName: t.cse.name,
      courseId: null,
      courseName: "Compiler Design and Construction",
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
      batch: "61",
    });
    // The compressed copy isn't kept.
    expect((await env.BUCKET.get(paper.fileKey))?.size).toBe(1009);
  });

  it("falls back to the original PDF when compression fails", async () => {
    const paper = await seedPaper();
    const job = await startRun(paper.id);
    const { fetch } = fakeFetch({
      reply: baseReply,
      compressor: () => Response.json({ message: "boom" }, { status: 500 }),
    });
    expect(await runAnalysis(db(), analysisEnv, job, { fetch })).toBe("done");
    expect(await analysisRow(paper.id)).toMatchObject({
      status: "completed",
      sentBytes: 1009,
    });
  });

  it("retries bad answers and fails after the last attempt", async () => {
    const paper = await seedPaper();
    const job = await startRun(paper.id);
    const { fetch } = fakeFetch({ reply: { isQuestionPaper: "maybe" } });

    expect(await runAnalysis(db(), analysisEnv, job, { fetch })).toBe("retry");
    expect(await analysisRow(paper.id)).toMatchObject({
      status: "queued",
      error: expect.stringContaining("Retrying"),
    });

    expect(
      await runAnalysis(db(), analysisEnv, job, {
        fetch,
        attempt: ANALYSIS_MAX_ATTEMPTS,
      }),
    ).toBe("done");
    expect(await analysisRow(paper.id)).toMatchObject({
      status: "failed",
      error: "Gemini's answer doesn't have the expected shape",
    });
  });

  it("doesn't retry client errors or a missing key", async () => {
    const paper = await seedPaper();
    const job = await startRun(paper.id);
    const { fetch } = fakeFetch({
      reply: baseReply,
      gemini: () => new Response("bad request", { status: 400 }),
    });
    expect(await runAnalysis(db(), analysisEnv, job, { fetch })).toBe("done");
    expect((await analysisRow(paper.id))?.status).toBe("failed");

    const next = await startRun(paper.id);
    expect(
      await runAnalysis(db(), { ...analysisEnv, GEMINI_API_KEY: "" }, next, {
        fetch,
      }),
    ).toBe("done");
    expect(await analysisRow(paper.id)).toMatchObject({
      status: "failed",
      error: expect.stringContaining("isn't configured"),
    });
  });

  it("ignores messages from a superseded run", async () => {
    const paper = await seedPaper();
    const old = await startRun(paper.id);
    await startRun(paper.id);
    const { fetch, calls } = fakeFetch({ reply: baseReply });
    expect(await runAnalysis(db(), analysisEnv, old, { fetch })).toBe("done");
    expect(calls).toHaveLength(0);
    expect((await analysisRow(paper.id))?.status).toBe("queued");
  });

  it("marks the run failed when it can't be queued", async () => {
    const paper = await seedPaper();
    const { queue } = fakeQueue(true);
    const analysis = await enqueueAnalysis(db(), queue, paper.id, {
      autoPublish: true,
    });
    expect(analysis).toMatchObject({
      status: "failed",
      error: "Couldn't queue the analysis",
    });
  });

  it("is deleted with its submission", async () => {
    const paper = await seedPaper();
    await startRun(paper.id);
    await db().delete(submissions).where(eq(submissions.id, paper.id));
    expect(await analysisRow(paper.id)).toBeUndefined();
  });
});

/** A pending paper filed under Algorithms · 1st semester · Midterm (all existing). */
async function seedFiledPaper() {
  const values = {
    departmentId: t.cse.id,
    courseId: t.algorithms.id,
    semesterId: t.sem1.id,
    examTypeId: t.midterm.id,
  };
  await db().insert(questions).values(values).onConflictDoNothing();
  const question = await db().query.questions.findFirst({
    where: eq(questions.courseId, t.algorithms.id),
  });
  return seedPaper({
    questionId: question!.id,
    departmentId: null,
    customCourseName: null,
    customSemesterName: null,
    examTypeId: null,
  });
}

/** Gemini's answer for the paper from `seedFiledPaper`. */
const confirmingReply = (): AnalysisReply => ({
  ...baseReply,
  department: { existingId: t.cse.id, name: t.cse.name, shortName: null },
  course: { existingId: t.algorithms.id, name: t.algorithms.name },
  semester: { existingId: t.sem1.id, name: t.sem1.name },
  examType: { existingId: t.midterm.id, name: t.midterm.name },
});

const submissionRow = (id: number) =>
  db().query.submissions.findFirst({ where: eq(submissions.id, id) });

describe("auto-publishing", () => {
  it("publishes a single paper whose four values the AI confirms", async () => {
    const paper = await seedFiledPaper();
    const job = await startRun(paper.id, true);
    const { fetch } = fakeFetch({ reply: confirmingReply() });
    await runAnalysis(db(), analysisEnv, job, { fetch });

    const row = await submissionRow(paper.id);
    expect(row?.status).toBe("published");
    expect(row?.autoPublishedAt).toBeInstanceOf(Date);
  });

  it.each<[string, (reply: AnalysisReply) => AnalysisReply]>([
    [
      "one value differs",
      (reply) => ({
        ...reply,
        examType: { existingId: t.final.id, name: t.final.name },
      }),
    ],
    ["the AI can't read a value", (reply) => ({ ...reply, semester: null })],
    [
      "it isn't a question paper",
      (reply) => ({ ...reply, isQuestionPaper: false }),
    ],
    ["the file has two papers", (reply) => ({ ...reply, paperCount: 2 })],
  ])("leaves it for review when %s", async (_, change) => {
    const paper = await seedFiledPaper();
    const job = await startRun(paper.id, true);
    const { fetch } = fakeFetch({ reply: change(confirmingReply()) });
    await runAnalysis(db(), analysisEnv, job, { fetch });
    expect((await submissionRow(paper.id))?.status).toBe("pending_review");
  });

  it("never publishes new entries, reported papers or re-runs", async () => {
    // Proposes a new course and semester.
    const proposal = await seedPaper();
    const proposalJob = await startRun(proposal.id, true);
    await runAnalysis(db(), analysisEnv, proposalJob, {
      fetch: fakeFetch({
        reply: {
          ...confirmingReply(),
          course: { existingId: null, name: proposal.customCourseName! },
          semester: { existingId: null, name: proposal.customSemesterName! },
          examType: { existingId: t.final.id, name: t.final.name },
        },
      }).fetch,
    });
    expect((await submissionRow(proposal.id))?.status).toBe("pending_review");

    const reported = await seedFiledPaper();
    await db().insert(submissionReports).values({
      submissionId: reported.id,
      reporterId: admin.id,
      reason: "other",
    });
    const reportedJob = await startRun(reported.id, true);
    await runAnalysis(db(), analysisEnv, reportedJob, {
      fetch: fakeFetch({ reply: confirmingReply() }).fetch,
    });
    expect((await submissionRow(reported.id))?.status).toBe("pending_review");

    const rerun = await seedFiledPaper();
    const rerunJob = await startRun(rerun.id, false);
    await runAnalysis(db(), analysisEnv, rerunJob, {
      fetch: fakeFetch({ reply: confirmingReply() }).fetch,
    });
    expect((await submissionRow(rerun.id))?.status).toBe("pending_review");
  });

  it("is undone by an admin's decision", async () => {
    const paper = await seedFiledPaper();
    const job = await startRun(paper.id, true);
    await runAnalysis(db(), analysisEnv, job, {
      fetch: fakeFetch({ reply: confirmingReply() }).fetch,
    });
    const res = await asAdmin(
      `/api/v1/admin/submissions/${paper.id}`,
      jsonRequest("PATCH", { status: "rejected", reason: "Wrong details." }),
    );
    expect(await res.json()).toMatchObject({
      status: "rejected",
      autoPublished: false,
    });
    expect((await submissionRow(paper.id))?.autoPublishedAt).toBeNull();
  });
});

describe("POST /api/v1/submissions", () => {
  it("starts an analysis of the upload", async () => {
    const body = new FormData();
    body.append("departmentId", String(t.cse.id));
    body.append("courseId", String(t.algorithms.id));
    body.append("semesterId", String(t.sem1.id));
    body.append("examTypeId", String(t.midterm.id));
    body.append("file", pdfFile());
    const res = await api("/api/v1/submissions", {
      method: "POST",
      headers: { cookie: member.cookie },
      body,
    });
    expect(res.status).toBe(201);
    const { id } = await res.json<{ id: number }>();
    const row = await analysisRow(id);
    expect(row?.runId).toEqual(expect.any(String));
    // Right after upload, a confirming check may publish the paper.
    expect(row?.autoPublish).toBe(true);
  });
});

/** Stores a completed analysis directly. */
async function seedAnalysis(
  submissionId: number,
  values: Partial<typeof submissionAnalyses.$inferInsert>,
) {
  await db()
    .insert(submissionAnalyses)
    .values({
      submissionId,
      runId: crypto.randomUUID(),
      status: "completed",
      isQuestionPaper: true,
      paperCount: 1,
      completedAt: new Date(),
      ...values,
    });
}

describe("admin analysis", () => {
  it("shows the analysis on the submission and in the list, with AI filters", async () => {
    const agrees = await seedPaper();
    await seedAnalysis(agrees.id, {
      departmentId: t.cse.id,
      departmentName: t.cse.name,
      // The same new name, in other case.
      courseName: agrees.customCourseName!.toUpperCase(),
      semesterName: agrees.customSemesterName,
      examTypeId: t.final.id,
      examTypeName: t.final.name,
    });
    const differs = await seedPaper();
    await seedAnalysis(differs.id, {
      examTypeId: t.midterm.id,
      examTypeName: t.midterm.name,
      section: "B",
    });
    const multiple = await seedPaper();
    await seedAnalysis(multiple.id, { paperCount: 3, note: "Three papers" });
    const notAPaper = await seedPaper();
    await seedAnalysis(notAPaper.id, {
      isQuestionPaper: false,
      paperCount: 0,
    });
    const pending = await seedPaper();
    await startRun(pending.id);
    const never = await seedPaper();

    const detail = await (
      await asAdmin(`/api/v1/admin/submissions/${differs.id}`)
    ).json<AdminSubmissionDetail>();
    expect(detail.analysis).toEqual({
      status: "completed",
      flag: null,
      matches: false,
    });
    expect(detail.analysisDetail).toMatchObject({
      status: "completed",
      flag: null,
      values: {
        department: null,
        examType: { id: t.midterm.id, name: t.midterm.name },
        section: "B",
      },
    });

    const list = await (
      await asAdmin("/api/v1/admin/submissions?pageSize=100")
    ).json<AdminSubmissionList>();
    const summary = (id: number) =>
      list.items.find((item) => item.id === id)?.analysis;
    expect(summary(agrees.id)).toEqual({
      status: "completed",
      flag: null,
      matches: true,
    });
    expect(summary(multiple.id)?.flag).toBe("multiple_papers");
    expect(summary(notAPaper.id)?.flag).toBe("not_a_paper");
    expect(summary(pending.id)).toEqual({
      status: "queued",
      flag: null,
      matches: null,
    });
    expect(summary(never.id)).toBeNull();

    const ids = async (ai: string) => {
      const res = await asAdmin(
        `/api/v1/admin/submissions?ai=${ai}&pageSize=100`,
      );
      const body = await res.json<AdminSubmissionList>();
      expect(body.total).toBe(body.items.length);
      return body.items.map((item) => item.id);
    };
    const flagged = await ids("flagged");
    expect(flagged).toEqual(
      expect.arrayContaining([multiple.id, notAPaper.id]),
    );
    expect(flagged).not.toContain(differs.id);
    const differing = await ids("differs");
    expect(differing).toContain(differs.id);
    expect(differing).not.toContain(agrees.id);
  });

  it("re-runs the analysis for admins only", async () => {
    const paper = await seedPaper();
    await seedAnalysis(paper.id, { courseName: "Old answer" });
    const before = await analysisRow(paper.id);

    const denied = await api(
      `/api/v1/admin/submissions/${paper.id}/analysis`,
      jsonRequest("POST", {}, member.cookie),
    );
    expect(denied.status).toBe(403);

    const res = await asAdmin(
      `/api/v1/admin/submissions/${paper.id}/analysis`,
      {
        method: "POST",
      },
    );
    expect(res.status).toBe(202);
    const analysis = await res.json<SubmissionAnalysis>();
    expect(analysis.values).toBeNull();
    const after = await analysisRow(paper.id);
    expect(after?.runId).not.toBe(before?.runId);
    expect(after?.autoPublish).toBe(false);
    expect(after?.courseName).toBeNull();

    const missing = await asAdmin("/api/v1/admin/submissions/999999/analysis", {
      method: "POST",
    });
    expect(missing.status).toBe(404);
  });

  it("checks never-checked pending papers like new uploads", async () => {
    const [unchecked, checked, rejected] = await Promise.all([
      seedPaper(),
      seedPaper(),
      seedPaper({ status: "rejected" }),
    ]);
    await startRun(checked.id);
    const { queue, sent } = fakeQueue();
    const queued = await checkUnchecked(db(), queue);
    const ids = sent.map((job) => job.submissionId);
    expect(ids).toContain(unchecked.id);
    expect(ids).not.toContain(checked.id);
    expect(ids).not.toContain(rejected.id);
    expect(queued).toBe(sent.length);
    // Like the check after an upload, a confirming result publishes the paper.
    expect((await analysisRow(unchecked.id))?.autoPublish).toBe(true);
    // Queued now, so the next call skips it.
    const again = fakeQueue();
    await checkUnchecked(db(), again.queue);
    expect(again.sent.map((job) => job.submissionId)).not.toContain(
      unchecked.id,
    );
  });

  it("starts the backfill through the API, for admins only", async () => {
    const denied = await api("/api/v1/admin/submissions/analysis", {
      method: "POST",
      headers: { cookie: member.cookie },
    });
    expect(denied.status).toBe(403);
    const res = await asAdmin("/api/v1/admin/submissions/analysis", {
      method: "POST",
    });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ queued: expect.any(Number) });
  });
});
