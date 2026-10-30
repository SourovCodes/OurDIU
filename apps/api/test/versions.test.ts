import { env } from "cloudflare:workers";
import type { QuestionDetail } from "@ourdiu/shared";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { questions, semesters, submissions } from "../src/db/schema";
import { saveText } from "../src/services/paper-text";
import {
  clusterTexts,
  groupNextVersions,
  groupVersions,
  rankCopies,
  rateNextPaper,
  saveQuality,
  type VersionsEnv,
} from "../src/services/versions";
import { api, db, seedQuestion, seedSubmission, seedTaxonomy } from "./helpers";

type Taxonomy = Awaited<ReturnType<typeof seedTaxonomy>>;

let t: Taxonomy;

beforeAll(async () => {
  t = await seedTaxonomy();
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

/** A published paper of `questionId` with its PDF in R2 and its text. */
async function seedPaper(
  questionId: number,
  text: string,
  values: Partial<typeof submissions.$inferInsert> = {},
) {
  const fileKey = `submissions/${crypto.randomUUID()}.pdf`;
  await env.BUCKET.put(fileKey, "%PDF-1.7\n" + "x".repeat(100));
  const paper = await seedSubmission(questionId, {
    fileKey,
    status: "published",
    ...values,
  });
  await saveText(db(), paper.id, { text, error: null, model: "test" });
  return paper;
}

const versionsEnv = {
  BUCKET: env.BUCKET,
  GEMINI_API_KEY: "gemini-test-key",
  GEMINI_TEXT_MODEL: "gemini-test",
  COMPRESSOR_API_KEY: "",
  PDF_PROCESSOR_URL: "https://pdf-processor.test",
} satisfies VersionsEnv;

/** Answers Gemini with `reply` (or `response`) and keeps the requests' bodies. */
function fakeGemini(reply: unknown, response?: () => Response) {
  const calls: string[] = [];
  const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
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

const HEADER = `Daffodil International University
Department of Computer Science and Engineering
Midterm Examination, Fall 2026
Course Code: CSE 221, Course Title: Algorithms
Time: 1.5 Hours, Marks: 25`;

const SET_A = `${HEADER}
Set: A

1. Sort the array 5, 2, 9, 1, 7 with merge sort and show every step. [5]
2. Find the shortest paths from vertex S with Dijkstra's algorithm in the given graph. [10]
[Figure: a weighted graph with vertices S, A, B, C, D]
3. Explain why quick sort takes quadratic time in the worst case, with an example. [10]`;

const SET_B = `${HEADER}
Set: B

1. Sort the array 8, 3, 6, 4, 2 with heap sort and show every step. [5]
2. Find a minimum spanning tree of the given graph with Kruskal's algorithm. [10]
[Figure: a weighted graph with vertices P, Q, R, S, T]
3. Explain how binary search halves the range at each step, with an example. [10]`;

/** The same paper read off another photo: different layout, a misread word. */
const SET_A_PHOTO = SET_A.replace("Set: A\n", "Set: A\n\n").replace(
  "every step",
  "evey step",
);

const versionsOf = async (questionId: number) =>
  (
    await db()
      .select({
        id: submissions.id,
        group: submissions.versionGroup,
        label: submissions.versionLabel,
      })
      .from(submissions)
      .where(eq(submissions.questionId, questionId))
      .orderBy(submissions.id)
  ).map(({ id, group, label }) => ({ id, group, label }));

const pending = async (questionId: number) =>
  (
    await db().query.questions.findFirst({
      where: eq(questions.id, questionId),
    })
  )?.versionsPending;

describe("clusterTexts", () => {
  it("puts copies of one paper together and keeps other sets apart", () => {
    expect(clusterTexts([SET_A, SET_B, SET_A_PHOTO])).toEqual([[0, 2], [1]]);
  });

  it("keeps apart papers that differ only in their numbers", () => {
    const otherNumbers = SET_A.replace("5, 2, 9, 1, 7", "6, 3, 8, 4, 0")
      .replace("[5]", "[6]")
      .replace(/\[10\]/g, "[12]");
    expect(clusterTexts([SET_A, otherNumbers])).toEqual([[0], [1]]);
  });

  it("matches a copy with a page missing", () => {
    const firstPage = SET_A.slice(0, SET_A.indexOf("3. Explain"));
    expect(clusterTexts([SET_A, firstPage])).toEqual([[0, 1]]);
  });

  it("reads scripts other than Latin", () => {
    const bangla =
      "১. বাংলা সাহিত্যের প্রথম নিদর্শন কী? ২. মধ্যযুগের প্রথম মহিলা কবি কে?";
    const other =
      "১. ছোটগল্প ও উপন্যাসের পার্থক্য লিখ। ২. গীতি কবিতা কাকে বলে?";
    expect(clusterTexts([bangla, bangla, other])).toEqual([[0, 1], [2]]);
  });
});

describe("rankCopies", () => {
  const copy = (
    id: number,
    values: Partial<Parameters<typeof rankCopies>[0][number]> = {},
  ) => ({
    id,
    quality: null,
    likeCount: 0,
    dislikeCount: 0,
    viewCount: 0,
    createdAt: new Date(2026, 0, id),
    versionGroup: null,
    versionLabel: null,
    ...values,
  });
  const order = (ranked: ReturnType<typeof rankCopies>) =>
    ranked.map((r) => [r.copy.id, r.version, r.versionLabel]);

  it("ranks one version by quality, with votes as a correction", () => {
    expect(
      order(
        rankCopies([
          copy(1, { quality: 70 }),
          copy(2, { quality: 90 }),
          // Unrated counts as 50, and three net likes add 15.
          copy(3, { likeCount: 4, dislikeCount: 1 }),
          // Votes are capped: they can't lift a poor copy over a good one.
          copy(4, { quality: 20, likeCount: 30 }),
        ]),
      ),
    ).toEqual([
      [2, null, null],
      [1, null, null],
      [3, null, null],
      [4, null, null],
    ]);
  });

  it("puts each version's best copy first, the largest version first", () => {
    const a = { versionGroup: 1, versionLabel: "Set A" };
    const b = { versionGroup: 2, versionLabel: "Set B" };
    expect(
      order(
        rankCopies([
          copy(1, { ...b, quality: 95 }),
          copy(2, { ...a, quality: 60 }),
          copy(3, { ...a, quality: 80 }),
          copy(4, { ...b, quality: 40 }),
          copy(5, { ...a, quality: 70 }),
          // Couldn't be grouped (no text): goes with the largest version.
          copy(6, { quality: 75 }),
        ]),
      ),
    ).toEqual([
      [3, 1, "Set A"],
      [1, 2, "Set B"],
      [6, 1, "Set A"],
      [5, 1, "Set A"],
      [2, 1, "Set A"],
      [4, 2, "Set B"],
    ]);
  });
});

describe("groupVersions", () => {
  it("marks exams whose published papers or texts change", async () => {
    const question = await seedExam();
    const draft = await seedSubmission(question.id, {
      status: "pending_review",
    });
    expect(await pending(question.id)).toBe(false);

    await db()
      .update(submissions)
      .set({ status: "published" })
      .where(eq(submissions.id, draft.id));
    expect(await pending(question.id)).toBe(true);

    // Its text is still to be read, so the exam waits for it.
    expect(await groupVersions(db(), versionsEnv, question.id)).toBe("wait");
    expect(await pending(question.id)).toBe(true);
    await saveText(db(), draft.id, { text: SET_A, error: null, model: "t" });
    expect(await groupVersions(db(), versionsEnv, question.id)).toBe("done");
    expect(await pending(question.id)).toBe(false);
    await saveText(db(), draft.id, { text: SET_B, error: null, model: "t" });
    expect(await pending(question.id)).toBe(true);

    // Moving it to another exam marks both.
    await groupVersions(db(), versionsEnv, question.id);
    const other = await seedExam();
    await db()
      .update(submissions)
      .set({ questionId: other.id })
      .where(eq(submissions.id, draft.id));
    expect(await pending(question.id)).toBe(true);
    expect(await pending(other.id)).toBe(true);

    await groupVersions(db(), versionsEnv, other.id);
    await db().delete(submissions).where(eq(submissions.id, draft.id));
    expect(await pending(other.id)).toBe(true);
  });

  it("settles copies of one paper without the AI", async () => {
    const question = await seedExam();
    await seedPaper(question.id, SET_A);
    await seedPaper(question.id, SET_A_PHOTO);
    const gemini = fakeGemini({ versions: [] });

    expect(
      await groupVersions(db(), versionsEnv, question.id, {
        fetch: gemini.fetch,
      }),
    ).toBe("done");
    expect(gemini.calls).toHaveLength(0);
    expect((await versionsOf(question.id)).every((v) => v.group === null)).toBe(
      true,
    );
  });

  it("asks the AI about different papers, then adds new copies itself", async () => {
    const question = await seedExam();
    const a = await seedPaper(question.id, SET_A);
    const b = await seedPaper(question.id, SET_B);
    const gemini = fakeGemini({
      versions: [
        { groups: [1], label: "Set A" },
        { groups: [2], label: " Set B " },
      ],
    });

    expect(
      await groupVersions(db(), versionsEnv, question.id, {
        fetch: gemini.fetch,
      }),
    ).toBe("ai");
    expect(gemini.calls).toHaveLength(1);
    // One sample text per cluster, after the instructions.
    expect(gemini.calls[0]).toContain("=== Group 2 ===");
    expect(await versionsOf(question.id)).toEqual([
      { id: a.id, group: 1, label: "Set A" },
      { id: b.id, group: 2, label: "Set B" },
    ]);

    // Another photo of set A joins it without another call.
    const photo = await seedPaper(question.id, SET_A_PHOTO);
    expect(await pending(question.id)).toBe(true);
    expect(
      await groupVersions(db(), versionsEnv, question.id, {
        fetch: gemini.fetch,
      }),
    ).toBe("done");
    expect(gemini.calls).toHaveLength(1);
    expect(await versionsOf(question.id)).toContainEqual({
      id: photo.id,
      group: 1,
      label: "Set A",
    });

    // The page shows the best copy of each version first.
    await saveQuality(db(), photo.id, 90, "Sharp scan");
    await saveQuality(db(), a.id, 40, "Blurry photo");
    const res = await api(`/api/v1/questions/${question.id}`);
    const detail = (await res.json()) as QuestionDetail;
    expect(
      detail.submissions.map((s) => [s.id, s.version, s.versionLabel]),
    ).toEqual([
      [photo.id, 1, "Set A"],
      [b.id, 2, "Set B"],
      [a.id, 1, "Set A"],
    ]);

    // Once set B is gone, the exam has one version again.
    await db().delete(submissions).where(eq(submissions.id, b.id));
    await groupVersions(db(), versionsEnv, question.id);
    expect((await versionsOf(question.id)).every((v) => v.group === null)).toBe(
      true,
    );
  });

  it("merges clusters the AI says are one paper", async () => {
    const question = await seedExam();
    await seedPaper(question.id, SET_A);
    await seedPaper(question.id, SET_B);
    const gemini = fakeGemini({
      versions: [{ groups: [1, 2], label: "Midterm" }],
    });
    await groupVersions(db(), versionsEnv, question.id, {
      fetch: gemini.fetch,
    });
    expect((await versionsOf(question.id)).every((v) => v.group === null)).toBe(
      true,
    );
  });

  it("waits for texts, a key, or the end of a rate limit", async () => {
    const question = await seedExam();
    await seedPaper(question.id, SET_A);
    await seedPaper(question.id, SET_B);

    // No API key: left pending.
    expect(
      await groupVersions(
        db(),
        { ...versionsEnv, GEMINI_API_KEY: "" },
        question.id,
      ),
    ).toBe("wait");
    expect(await pending(question.id)).toBe(true);

    // Rate limited: left pending for a later run.
    const limited = fakeGemini(
      null,
      () => new Response("quota", { status: 429 }),
    );
    expect(
      await groupVersions(db(), versionsEnv, question.id, {
        fetch: limited.fetch,
      }),
    ).toBe("ai");
    expect(await pending(question.id)).toBe(true);

    // An answer that leaves a group out: dropped until the exam changes again.
    const partial = fakeGemini({ versions: [{ groups: [1], label: "A" }] });
    await groupVersions(db(), versionsEnv, question.id, {
      fetch: partial.fetch,
    });
    expect(await pending(question.id)).toBe(false);
    expect((await versionsOf(question.id)).every((v) => v.group === null)).toBe(
      true,
    );

    // A paper whose text is still to be read.
    await seedSubmission(question.id, { status: "published" });
    expect(await groupVersions(db(), versionsEnv, question.id)).toBe("wait");
  });

  it("sorts pending exams in the cron until one needs the AI", async () => {
    const same = await seedExam();
    await seedPaper(same.id, SET_A);
    await seedPaper(same.id, SET_A_PHOTO);
    const different = await seedExam();
    await seedPaper(different.id, SET_A);
    await seedPaper(different.id, SET_B);
    const gemini = fakeGemini({
      versions: [
        { groups: [1], label: "Set A" },
        { groups: [2], label: "Set B" },
      ],
    });

    // Newest first: the exam with two sets takes the run's one call.
    expect(
      await groupNextVersions(db(), versionsEnv, { fetch: gemini.fetch }),
    ).toBe(different.id);
    expect(await pending(different.id)).toBe(false);
    expect(await pending(same.id)).toBe(true);

    // The next run settles the rest without a call.
    while (await groupNextVersions(db(), versionsEnv, { fetch: gemini.fetch }));
    expect(await pending(same.id)).toBe(false);
    expect(gemini.calls).toHaveLength(1);
  });
});

describe("rateNextPaper", () => {
  it("rates unrated papers, exams with the most copies first", async () => {
    // Earlier tests left unrated papers; rate them all, then check the order.
    const gemini = fakeGemini({ quality: 73.4, qualityNote: "Good photo" });
    while (await rateNextPaper(db(), versionsEnv, { fetch: gemini.fetch }));

    const single = await seedExam();
    const lone = await seedPaper(single.id, SET_A);
    const busy = await seedExam();
    const first = await seedPaper(busy.id, SET_A);
    const second = await seedPaper(busy.id, SET_A_PHOTO);
    // Rated by the upload check already.
    await saveQuality(db(), second.id, 90, "Sharp scan");

    expect(
      await rateNextPaper(db(), versionsEnv, { fetch: gemini.fetch }),
    ).toBe(first.id);
    const rated = await db().query.submissions.findFirst({
      where: eq(submissions.id, first.id),
    });
    expect(rated).toMatchObject({ quality: 73, qualityNote: "Good photo" });

    // A failure is kept, so the paper isn't tried again; a rate limit isn't.
    const limited = fakeGemini(
      null,
      () => new Response("quota", { status: 429 }),
    );
    expect(
      await rateNextPaper(db(), versionsEnv, { fetch: limited.fetch }),
    ).toBe(lone.id);
    const broken = fakeGemini({ quality: "high" });
    expect(
      await rateNextPaper(db(), versionsEnv, { fetch: broken.fetch }),
    ).toBe(lone.id);
    expect(
      await db().query.submissions.findFirst({
        where: eq(submissions.id, lone.id),
      }),
    ).toMatchObject({
      quality: null,
      qualityNote: expect.stringMatching(/^Couldn't rate/),
    });
    expect(
      await rateNextPaper(db(), versionsEnv, { fetch: gemini.fetch }),
    ).toBeNull();

    // Nothing without a key.
    expect(
      await rateNextPaper(db(), { ...versionsEnv, GEMINI_API_KEY: "" }),
    ).toBeNull();
  });
});
