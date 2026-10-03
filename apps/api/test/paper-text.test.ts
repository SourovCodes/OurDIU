import { env } from "cloudflare:workers";
import type {
  PaperSearchList,
  QuestionDetail,
  TextsQueued,
} from "@ourdiu/shared";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { semesters, submissions, submissionTexts } from "../src/db/schema";
import { matchExpression, snippetParts } from "../src/services/paper-search";
import {
  cleanText,
  nextMissingText,
  readMissingTexts,
  readNextMissingText,
  runTextRead,
  saveText,
  TEXT_MAX_ATTEMPTS,
  TEXT_RETRY_AFTER_MS,
  type TextEnv,
  type TextJob,
} from "../src/services/paper-text";
import {
  api,
  db,
  seedQuestion,
  seedSubmission,
  seedTaxonomy,
  signIn,
  signInAdmin,
} from "./helpers";

type Taxonomy = Awaited<ReturnType<typeof seedTaxonomy>>;

let t: Taxonomy;
let admin: Awaited<ReturnType<typeof signInAdmin>>;
let member: Awaited<ReturnType<typeof signIn>>;

beforeAll(async () => {
  [t, admin, member] = await Promise.all([
    seedTaxonomy(),
    signInAdmin(),
    signIn(),
  ]);
});

/** Each call gets an exam of its own (a new semester, so the combination is new). */
async function seedExam() {
  const [semester] = await db()
    .insert(semesters)
    .values({ name: `Term ${crypto.randomUUID()}` })
    .returning();
  return seedQuestion({
    departmentId: t.cse.id,
    courseId: t.algorithms.id,
    semesterId: semester!.id,
    examTypeId: t.final.id,
  });
}

/** A published paper of a new exam, with its PDF in R2 and optionally its text. */
async function seedPaper(
  text?: string,
  status: "published" | "pending_review" = "published",
) {
  const question = await seedExam();
  const fileKey = `submissions/${crypto.randomUUID()}.pdf`;
  await env.BUCKET.put(fileKey, "%PDF-1.7\n" + "x".repeat(100));
  const paper = await seedSubmission(question.id, { fileKey, status });
  if (text !== undefined) {
    await saveText(db(), paper.id, { text, error: null, model: "test" });
  }
  return { question, paper };
}

const textRow = (submissionId: number) =>
  db().query.submissionTexts.findFirst({
    where: eq(submissionTexts.submissionId, submissionId),
  });

const textEnv = {
  BUCKET: env.BUCKET,
  GEMINI_API_KEY: "gemini-test-key",
  GEMINI_TEXT_MODEL: "gemini-test",
  COMPRESSOR_API_KEY: "",
  PDF_PROCESSOR_URL: "https://pdf-processor.test",
} satisfies TextEnv;

/** Answers Gemini with `reply` (or `response`) and counts the calls. */
function fakeGemini(reply: unknown, response?: () => Response) {
  const calls: string[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(init?.body ?? ""));
    return (
      response?.() ??
      Response.json({
        candidates: [
          {
            content: { parts: [{ text: JSON.stringify(reply) }] },
            finishReason: "STOP",
          },
        ],
      })
    );
  }) as typeof fetch;
  return { fetch: fetcher, calls };
}

function fakeQueue(failing = false) {
  const sent: TextJob[] = [];
  const queue = {
    sendBatch: async (messages: { body: TextJob }[]) => {
      if (failing) throw new Error("queue down");
      sent.push(...messages.map((m) => m.body));
    },
  } as unknown as Queue<TextJob>;
  return { queue, sent };
}

const search = async (q: string, query = "") => {
  const res = await api(
    `/api/v1/questions/search?q=${encodeURIComponent(q)}${query}`,
  );
  return { status: res.status, body: await res.json<PaperSearchList>() };
};

describe("cleanText", () => {
  it("trims lines, keeps one blank line between questions and drops empty text", () => {
    expect(
      cleanText("  Final Exam  \r\n\r\n\r\n\r\n1. Define a graph.   \n"),
    ).toBe("Final Exam\n\n1. Define a graph.");
    expect(cleanText(" \n \n")).toBeNull();
  });
});

describe("runTextRead", () => {
  it("reads a published paper's text with one AI call", async () => {
    const { paper } = await seedPaper();
    const { fetch, calls } = fakeGemini({ text: "1. Define a heap.\n" });
    expect(
      await runTextRead(
        db(),
        textEnv,
        { kind: "text", submissionId: paper.id },
        { fetch },
      ),
    ).toBe("done");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("transcribed exactly as printed");
    expect(await textRow(paper.id)).toMatchObject({
      text: "1. Define a heap.",
      error: null,
      model: "gemini-test",
    });
  });

  it("skips papers that aren't published or already have their text", async () => {
    const pending = await seedPaper(undefined, "pending_review");
    const read = await seedPaper("Already read");
    const { fetch, calls } = fakeGemini({ text: "new" });
    for (const { paper } of [pending, read]) {
      await runTextRead(
        db(),
        textEnv,
        { kind: "text", submissionId: paper.id },
        { fetch },
      );
    }
    expect(calls).toHaveLength(0);
    expect(await textRow(pending.paper.id)).toBeUndefined();
    expect((await textRow(read.paper.id))?.text).toBe("Already read");
  });

  it("retries, and stores the failure after the last attempt", async () => {
    const { paper } = await seedPaper();
    const job = { kind: "text", submissionId: paper.id } as const;
    const { fetch } = fakeGemini(null, () =>
      Response.json({ error: { message: "overloaded" } }, { status: 503 }),
    );
    expect(await runTextRead(db(), textEnv, job, { fetch, attempt: 1 })).toBe(
      "retry",
    );
    expect(await textRow(paper.id)).toBeUndefined();
    expect(
      await runTextRead(db(), textEnv, job, {
        fetch,
        attempt: TEXT_MAX_ATTEMPTS,
      }),
    ).toBe("done");
    expect(await textRow(paper.id)).toMatchObject({ text: null });
    expect((await textRow(paper.id))?.error).toContain("overloaded");
  });
});

describe("readMissingTexts", () => {
  it("queues published papers without text or whose read failed", async () => {
    const missing = await seedPaper();
    const failed = await seedPaper();
    await saveText(db(), failed.paper.id, {
      text: null,
      error: "boom",
      model: null,
    });
    const read = await seedPaper("Done");
    const pending = await seedPaper(undefined, "pending_review");

    const { queue, sent } = fakeQueue();
    await readMissingTexts(db(), queue);
    const ids = sent.map((job) => job.submissionId);
    expect(ids).toContain(missing.paper.id);
    expect(ids).toContain(failed.paper.id);
    expect(ids).not.toContain(read.paper.id);
    expect(ids).not.toContain(pending.paper.id);
    expect(sent.every((job) => job.kind === "text")).toBe(true);
  });

  it("marks papers failed when they can't be queued, so the next run retries", async () => {
    const { paper } = await seedPaper();
    const { queue } = fakeQueue(true);
    await readMissingTexts(db(), queue);
    expect((await textRow(paper.id))?.error).toBe("Couldn't queue the read");
  });

  it("is started through the API, by admins only", async () => {
    const asMember = await api("/api/v1/admin/submissions/text", {
      method: "POST",
      headers: { cookie: member.cookie },
    });
    expect(asMember.status).toBe(403);
    const res = await api("/api/v1/admin/submissions/text", {
      method: "POST",
      headers: { cookie: admin.cookie },
    });
    expect(res.status).toBe(202);
    expect((await res.json<TextsQueued>()).queued).toBeGreaterThan(0);
  });
});

describe("the cron's backfill", () => {
  /** Gives every paper still missing its text one, so `nextMissingText` sees only new ones. */
  async function readEverything() {
    let id: number | null;
    while ((id = await nextMissingText(db(), new Date(8.64e15))) !== null) {
      await saveText(db(), id, { text: "read", error: null, model: "test" });
    }
  }

  it("picks never-read papers oldest first, then failures over a week old", async () => {
    await readEverything();
    const now = new Date();
    const failed = await seedPaper();
    await saveText(db(), failed.paper.id, {
      text: null,
      error: "boom",
      model: "test",
    });
    const first = await seedPaper();
    const second = await seedPaper();
    await seedPaper("Already read");
    await seedPaper(undefined, "pending_review");

    expect(await nextMissingText(db(), now)).toBe(first.paper.id);
    await saveText(db(), first.paper.id, {
      text: "a",
      error: null,
      model: "t",
    });
    expect(await nextMissingText(db(), now)).toBe(second.paper.id);
    await saveText(db(), second.paper.id, {
      text: "b",
      error: null,
      model: "t",
    });
    // The failure waits a week.
    expect(await nextMissingText(db(), now)).toBeNull();
    const weekLater = new Date(now.getTime() + TEXT_RETRY_AFTER_MS + 60_000);
    expect(await nextMissingText(db(), weekLater)).toBe(failed.paper.id);
  });

  it("reads one paper per run", async () => {
    await readEverything();
    const first = await seedPaper();
    const second = await seedPaper();
    const { fetch, calls } = fakeGemini({ text: "1. Define a tree." });
    expect(await readNextMissingText(db(), textEnv, { fetch })).toBe(
      first.paper.id,
    );
    expect(calls).toHaveLength(1);
    expect((await textRow(first.paper.id))?.text).toBe("1. Define a tree.");
    expect(await textRow(second.paper.id)).toBeUndefined();
  });

  it("stores a failure straight away, but leaves a rate-limited paper for the next run", async () => {
    await readEverything();
    const { paper } = await seedPaper();
    const limited = fakeGemini(null, () =>
      Response.json({ error: { message: "quota" } }, { status: 429 }),
    );
    await readNextMissingText(db(), textEnv, { fetch: limited.fetch });
    expect(await textRow(paper.id)).toBeUndefined();

    const broken = fakeGemini(null, () =>
      Response.json({ error: { message: "overloaded" } }, { status: 503 }),
    );
    await readNextMissingText(db(), textEnv, { fetch: broken.fetch });
    expect((await textRow(paper.id))?.error).toContain("overloaded");
    expect(await nextMissingText(db())).toBeNull();
  });

  it("does nothing without an API key", async () => {
    await readEverything();
    const { paper } = await seedPaper();
    const { fetch, calls } = fakeGemini({ text: "x" });
    expect(
      await readNextMissingText(
        db(),
        { ...textEnv, GEMINI_API_KEY: "" },
        { fetch },
      ),
    ).toBeNull();
    expect(calls).toHaveLength(0);
    expect(await textRow(paper.id)).toBeUndefined();
  });
});

describe("GET /api/v1/questions/{id}", () => {
  it("includes the text of published papers only", async () => {
    const { question, paper } = await seedPaper("1. What is a stack?");
    const pending = await seedSubmission(question.id, {
      status: "pending_review",
    });
    await saveText(db(), pending.id, {
      text: "Secret draft",
      error: null,
      model: "test",
    });
    const other = await seedSubmission(question.id);

    const body = await (
      await api(`/api/v1/questions/${question.id}`)
    ).json<QuestionDetail>();
    const byId = new Map(body.submissions.map((s) => [s.id, s.text]));
    expect(byId.get(paper.id)).toBe("1. What is a stack?");
    expect(byId.get(pending.id)).toBeNull();
    expect(byId.get(other.id)).toBeNull();
  });
});

describe("matchExpression", () => {
  it("quotes every word, lets the last be a prefix and drops FTS5 syntax", () => {
    expect(matchExpression("binary  tree")).toBe('"binary" "tree"*');
    expect(matchExpression('NEAR(a b) OR "x" -y*')).toBe(
      '"NEAR" "a" "b" "OR" "x" "y"*',
    );
    expect(matchExpression("বাংলা প্রশ্ন")).toBe('"বাংলা" "প্রশ্ন"*');
    expect(matchExpression("?? ...")).toBeNull();
  });
});

describe("snippetParts", () => {
  it("splits the marked matches out and puts the snippet on one line", () => {
    expect(snippetParts("…a \u0002heap\u0003\nis \u0002sorted\u0003")).toEqual([
      { text: "…a ", match: false },
      { text: "heap", match: true },
      { text: " is ", match: false },
      { text: "sorted", match: true },
    ]);
  });
});

describe("GET /api/v1/questions/search", () => {
  it("finds published papers by the words in their text, one hit per exam", async () => {
    const word = `zq${crypto.randomUUID().slice(0, 8)}`;
    const { question, paper } = await seedPaper(
      `Final Exam\n\n1. Explain ${word} with an example.\n2. Sort the array.`,
    );
    // A second copy of the same exam matches too, but the exam is listed once.
    const copy = await seedSubmission(question.id);
    await saveText(db(), copy.id, {
      text: `${word} ${word} ${word}`,
      error: null,
      model: "test",
    });
    await seedPaper(`Unpublished ${word}`, "pending_review");

    const { status, body } = await search(`${word} example`);
    expect(status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    const [hit] = body.items;
    expect(hit!.question).toEqual({
      id: question.id,
      department: t.cse,
      course: { id: t.algorithms.id, name: t.algorithms.name },
      semester: expect.objectContaining({ id: question.semesterId }),
      examType: t.final,
    });
    expect(hit!.submissionId).toBe(paper.id);
    expect(hit!.snippet.filter((p) => p.match).map((p) => p.text)).toEqual([
      word,
      "example",
    ]);
  });

  it("matches word starts and other forms of a word", async () => {
    // Letters then digits: a random ending like "bb" would stem differently
    // ("…bbing" → "…b"), so "…bb" wouldn't start it.
    const word = `zorbl${crypto.getRandomValues(new Uint32Array(1))[0]}`;
    const { question } = await seedPaper(
      `Describe the algorithms of ${word}ing.`,
    );
    for (const q of [`algorithm ${word}`, `${word}ing algo`]) {
      const { body } = await search(q);
      expect(body.items.map((hit) => hit.question.id)).toEqual([question.id]);
    }
  });

  it("stays in step with changed and deleted texts", async () => {
    const word = `wv${crypto.randomUUID().slice(0, 8)}`;
    const { paper } = await seedPaper(`Old ${word}`);
    expect((await search(word)).body.total).toBe(1);

    await saveText(db(), paper.id, {
      text: "Replaced",
      error: null,
      model: "test",
    });
    expect((await search(word)).body.total).toBe(0);
    expect(
      (await search("Replaced")).body.items.map((h) => h.submissionId),
    ).toContain(paper.id);

    await saveText(db(), paper.id, {
      text: `Back ${word}`,
      error: null,
      model: "test",
    });
    await db().delete(submissions).where(eq(submissions.id, paper.id));
    expect((await search(word)).body.total).toBe(0);
  });

  it("pages through results and rejects queries that are too short", async () => {
    const word = `pg${crypto.randomUUID().slice(0, 8)}`;
    for (let i = 0; i < 3; i++) await seedPaper(`Question ${word}`);
    const first = await search(word, "&pageSize=2");
    const second = await search(word, "&pageSize=2&page=2");
    expect(first.body.total).toBe(3);
    expect(first.body.items).toHaveLength(2);
    expect(second.body.items).toHaveLength(1);
    expect((await search("a")).status).toBe(422);
    expect((await search("?!")).body).toMatchObject({ items: [], total: 0 });
  });
});
