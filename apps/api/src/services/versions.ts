import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db/client";
import { questions, submissions, submissionTexts } from "../db/schema";
import { readPdfForAi } from "../lib/ai-pdf";
import { GeminiError, generateJson, generateJsonFromPdf } from "../lib/gemini";
import type { Fetcher } from "../lib/pdf-processor";
import type { TextEnv } from "./paper-text";

// Several students often upload the same exam. Their copies differ in how readable
// they are, and sometimes in their questions: sets, sections, retakes, a paper filed
// under the wrong exam. So each paper gets a quality rating (in the upload check's AI
// call, or by the cron for older papers), and each exam's papers are sorted into
// versions by their texts: copies whose texts clearly match are put together here,
// and only when more than one such cluster is left does the AI (one text-only call,
// one sample text per cluster) decide which are the same paper and label the
// versions. The question page then shows the best copy of each version first
// (`rankCopies`). Only midterms and finals: a quiz's copies are mostly different
// sections' quizzes, ranked by votes as before. docs/PLAN.md, decision 68.

/**
 * Whether an exam type's papers are sorted into versions and ranked by quality:
 * midterms and finals ("Midterm", "Mid-term", "Final"), not quizzes. Matches
 * `versionedExamType`.
 */
export function hasVersions(examTypeName: string): boolean {
  return /^(mid|final)/i.test(examTypeName.trim());
}

/** `hasVersions` in SQL, for an `exam_types` row aliased `e`. */
const versionedExamType = sql.raw(
  `(lower(trim(e.name)) like 'mid%' or lower(trim(e.name)) like 'final%')`,
);

/** How the AI rates a copy; part of the upload check's prompt too. */
export const QUALITY_INSTRUCTIONS = `how easy this copy is to read, from 0 to 100, judging the copy, not the questions:
  - 90-100: a clean digital PDF or a flat, sharp scan; every word easy to read; nothing written on it.
  - 70-89: a good photo or scan, readable throughout, with small flaws (a slight angle or shadow, a dark background, a few marks).
  - 40-69: readable with effort: blur, skew, poor light, glare, cut-off edges, or answers and notes written over some questions.
  - 1-39: hard to read: parts illegible, pages or questions missing, or heavy writing over the paper.
  - 0: not a question paper, or nothing readable.`;

/** The reason for the rating, a few words; part of the upload check's prompt too. */
export const QUALITY_NOTE_INSTRUCTIONS = `a few words on the copy's quality (e.g. "Sharp scan", "Photo at an angle, notes in the margins").`;

/** A rating as stored: whole numbers from 0 to 100. */
export function cleanQuality(quality: number): number {
  return Math.min(100, Math.max(0, Math.round(quality)));
}

/** Stores a paper's rating without touching `updated_at`. */
export async function saveQuality(
  db: Database,
  submissionId: number,
  quality: number | null,
  note: string | null,
): Promise<void> {
  await db.run(
    sql`update submissions set quality = ${quality}, quality_note = ${note?.trim().slice(0, 200) || null} where id = ${submissionId}`,
  );
}

// ── Ranking ──────────────────────────────────────────────────────────────────

/** The rating assumed for a paper that hasn't been rated yet. */
const UNRATED_QUALITY = 50;

/** Points per net like, up to `MAX_VOTE_POINTS` either way: readers can correct the AI. */
const POINTS_PER_VOTE = 5;
const MAX_VOTE_POINTS = 20;

type Copy = {
  id: number;
  quality: number | null;
  likeCount: number;
  dislikeCount: number;
  viewCount: number;
  createdAt: Date;
  versionGroup: number | null;
  versionLabel: string | null;
};

/** The order before ratings, and still a quiz's: votes, then views, then newest. */
function compareByVotes(a: Copy, b: Copy): number {
  return (
    b.likeCount - b.dislikeCount - (a.likeCount - a.dislikeCount) ||
    b.viewCount - a.viewCount ||
    b.createdAt.getTime() - a.createdAt.getTime()
  );
}

function copyScore(copy: Copy): number {
  const votes = (copy.likeCount - copy.dislikeCount) * POINTS_PER_VOTE;
  return (
    (copy.quality ?? UNRATED_QUALITY) +
    Math.max(-MAX_VOTE_POINTS, Math.min(MAX_VOTE_POINTS, votes))
  );
}

function compareCopies(a: Copy, b: Copy): number {
  return (
    copyScore(b) - copyScore(a) ||
    b.viewCount - a.viewCount ||
    b.createdAt.getTime() - a.createdAt.getTime()
  );
}

/**
 * Orders an exam's published papers: the best copy of each version (the version
 * most students uploaded first), then the other copies, version by version. Returns
 * each paper's version number in that order (1, 2, …), null while the exam has one
 * version. Old apps that only know the order get the best copies first too.
 * Exams without versions (`hasVersions`, quizzes) are ranked by votes alone.
 */
export function rankCopies<T extends Copy>(
  copies: T[],
  { versioned }: { versioned: boolean },
): { copy: T; version: number | null; versionLabel: string | null }[] {
  if (!versioned) {
    return [...copies]
      .sort(compareByVotes)
      .map((copy) => ({ copy, version: null, versionLabel: null }));
  }
  const groups = new Map<number, T[]>();
  for (const copy of copies) {
    // A paper left out of the grouping (its text couldn't be read) goes with the
    // version most students uploaded, see below.
    const key = copy.versionGroup ?? 0;
    groups.set(key, [...(groups.get(key) ?? []), copy]);
  }
  const versions = [...groups.values()].map((group) =>
    group.sort(compareCopies),
  );
  if (versions.length === 1) {
    return versions[0]!.map((copy) => ({
      copy,
      version: null,
      versionLabel: null,
    }));
  }
  versions.sort((a, b) => b.length - a.length || compareCopies(a[0]!, b[0]!));
  const largest = versions.find((v) => v[0]!.versionGroup !== null)!;
  const ungrouped = versions.find((v) => v[0]!.versionGroup === null);
  if (ungrouped) {
    largest.push(...ungrouped);
    largest.sort(compareCopies);
    versions.splice(versions.indexOf(ungrouped), 1);
  }
  if (versions.length === 1) {
    return versions[0]!.map((copy) => ({
      copy,
      version: null,
      versionLabel: null,
    }));
  }
  const ranked = versions.flatMap((group, i) =>
    group.map((copy, n) => ({
      copy,
      best: n === 0,
      version: i + 1,
      versionLabel: group[0]!.versionLabel,
    })),
  );
  return [
    ...ranked.filter((r) => r.best),
    ...ranked.filter((r) => !r.best),
  ].map(({ copy, version, versionLabel }) => ({
    copy,
    version,
    versionLabel,
  }));
}

// ── Clustering by text ───────────────────────────────────────────────────────

/**
 * How much of two texts must match for them to be the same paper without asking the
 * AI: of their three-word runs, and of their numbers (sets of one exam often differ
 * only in numbers). Measured on production papers in October 2026: copies of one
 * paper mostly match above 0.9, while different sets can match up to 0.85 in words.
 */
export const SAME_PAPER_MATCH = 0.9;

type Bag = Map<string, number>;

function bagOf(items: string[]): Bag {
  const bag: Bag = new Map();
  for (const item of items) bag.set(item, (bag.get(item) ?? 0) + 1);
  return bag;
}

const sizeOf = (bag: Bag) => [...bag.values()].reduce((a, b) => a + b, 0);

/** How much of the smaller bag is in the other one (so a missing page still matches). */
function containment(a: Bag, b: Bag): number {
  const smaller = Math.min(sizeOf(a), sizeOf(b));
  if (smaller === 0) return sizeOf(a) === sizeOf(b) ? 1 : 0;
  let shared = 0;
  for (const [item, count] of a) shared += Math.min(count, b.get(item) ?? 0);
  return shared / smaller;
}

type Fingerprint = { words: Bag; numbers: Bag };

export function fingerprint(text: string): Fingerprint {
  const tokens = text.toLowerCase().match(/[\p{L}\p{M}]+|\p{N}+/gu) ?? [];
  const runs = tokens
    .slice(2)
    .map((_, i) => `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
  return {
    words: bagOf(runs),
    numbers: bagOf(text.match(/\p{N}+/gu) ?? []),
  };
}

export function samePaper(a: Fingerprint, b: Fingerprint): boolean {
  return (
    containment(a.words, b.words) >= SAME_PAPER_MATCH &&
    containment(a.numbers, b.numbers) >= SAME_PAPER_MATCH
  );
}

/** Groups texts that clearly match (transitively). Returns the groups of indexes. */
export function clusterTexts(texts: string[]): number[][] {
  const prints = texts.map(fingerprint);
  const parent = texts.map((_, i) => i);
  const root = (i: number): number =>
    parent[i] === i ? i : (parent[i] = root(parent[i]!));
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      if (root(i) !== root(j) && samePaper(prints[i]!, prints[j]!)) {
        parent[root(j)] = root(i);
      }
    }
  }
  const clusters = new Map<number, number[]>();
  texts.forEach((_, i) =>
    clusters.set(root(i), [...(clusters.get(root(i)) ?? []), i]),
  );
  return [...clusters.values()];
}

// ── Sorting an exam into versions ────────────────────────────────────────────

/** The longest sample text sent per cluster: the header and the first questions. */
const MAX_SAMPLE_LENGTH = 5000;

/** Longest label kept. */
const MAX_LABEL_LENGTH = 40;

const VERSIONS_PROMPT = `Students uploaded these copies of question papers for one exam (the same course, semester and exam type). Each numbered group below holds copies of one paper; you see the text of one copy per group, transcribed from a photo or scan.

1. Put together the groups that are the same question paper: the same questions, even if transcribed differently (layout, spelling, recognition mistakes, a missing page). Papers whose questions differ, even only partly or only in their numbers, are different versions (sets, sections, a retake, or another exam filed here by mistake). List every group number exactly once.
2. Label each version in at most 30 characters, telling students how it differs from the others. Prefer what is printed on it: its set ("Set B"), sections ("Sections A-D", "Section 70-B"), batch, date ("12 Oct"), exam ("Class test 2"), or "Retake". If nothing printed differs, say what its first question is about in two to four words ("Starts with Huffman coding"). Sentence case, without the course name or semester; every label different.`;

const versionsResponseJsonSchema = {
  type: "object",
  properties: {
    versions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          groups: { type: "array", items: { type: "integer" } },
          label: { type: "string" },
        },
        required: ["groups", "label"],
      },
    },
  },
  required: ["versions"],
};

const versionsReplySchema = z.object({
  versions: z.array(
    z.object({ groups: z.array(z.number().int()), label: z.string() }),
  ),
});

/** The bindings grouping and rating need (as the text backfill's). */
export type VersionsEnv = TextEnv;

type Paper = {
  id: number;
  text: string | null;
  textPending: boolean;
  versionGroup: number | null;
  versionLabel: string | null;
};

async function writeVersions(
  db: Database,
  papers: { id: number }[],
  versionOf: (paper: { id: number }) => {
    group: number | null;
    label: string | null;
  },
) {
  const [first, ...rest] = papers.map((paper) => {
    const { group, label } = versionOf(paper);
    return (
      db
        .update(submissions)
        // `updated_at` stays the upload's.
        .set({
          versionGroup: group,
          versionLabel: label,
          updatedAt: sql`${submissions.updatedAt}`,
        })
        .where(eq(submissions.id, paper.id))
    );
  });
  if (first) await db.batch([first, ...rest]);
}

/**
 * The stored versions, if they still fit the clusters: every cluster has a grouped
 * paper, and its grouped papers are all in one version. A new copy that clearly
 * matches an earlier one joins its version without asking the AI again.
 */
function storedVersions(
  clusters: Paper[][],
): Map<Paper[], { group: number; label: string | null }> | null {
  const result = new Map<Paper[], { group: number; label: string | null }>();
  for (const cluster of clusters) {
    const grouped = cluster.filter((p) => p.versionGroup !== null);
    const groups = new Set(grouped.map((p) => p.versionGroup));
    if (groups.size !== 1) return null;
    result.set(cluster, {
      group: grouped[0]!.versionGroup!,
      label: grouped[0]!.versionLabel,
    });
  }
  return new Set([...result.values()].map((v) => v.group)).size > 1
    ? result
    : null;
}

/**
 * Sorts one exam's published papers into versions. Returns "ai" when it asked the
 * AI, "done" when the texts settled it, and "wait" when it can't yet (a text is still
 * to be read, or the AI is needed but not configured or rate limited), leaving the
 * exam pending.
 */
export async function groupVersions(
  db: Database,
  env: VersionsEnv,
  questionId: number,
  options: { fetch?: Fetcher } = {},
): Promise<"done" | "ai" | "wait"> {
  // Cleared first, so a change while this runs marks the exam again.
  await db.run(
    sql`update questions set versions_pending = 0 where id = ${questionId}`,
  );
  const wait = async () => {
    await db.run(
      sql`update questions set versions_pending = 1 where id = ${questionId}`,
    );
    return "wait" as const;
  };

  const [exam] = await db.all<{ examType: string }>(sql`
    select e.name as examType from questions q
    join exam_types e on e.id = q.exam_type_id
    where q.id = ${questionId}`);
  const oneVersion = () => ({ group: null, label: null });

  const papers: Paper[] = await db
    .select({
      id: submissions.id,
      text: submissionTexts.text,
      textPending: submissions.textPending,
      versionGroup: submissions.versionGroup,
      versionLabel: submissions.versionLabel,
    })
    .from(submissions)
    .leftJoin(submissionTexts, eq(submissionTexts.submissionId, submissions.id))
    .where(
      and(
        eq(submissions.questionId, questionId),
        eq(submissions.status, "published"),
      ),
    )
    .orderBy(submissions.id);
  if (!exam || !hasVersions(exam.examType)) {
    await writeVersions(db, papers, oneVersion);
    return "done";
  }
  if (papers.some((p) => p.textPending)) return wait();

  // Papers without text stay out of the versions; ranking puts them with the
  // largest one.
  const readable = papers.filter((p) => p.text);
  const clusters =
    readable.length < 2
      ? [readable]
      : clusterTexts(readable.map((p) => p.text!)).map((cluster) =>
          cluster.map((i) => readable[i]!),
        );
  if (clusters.length <= 1) {
    await writeVersions(db, papers, oneVersion);
    return "done";
  }

  const stored = storedVersions(clusters);
  if (stored) {
    const byPaper = new Map(
      [...stored].flatMap(([cluster, v]) => cluster.map((p) => [p.id, v])),
    );
    await writeVersions(db, papers, (p) => byPaper.get(p.id) ?? oneVersion());
    return "done";
  }

  if (!env.GEMINI_API_KEY) return wait();
  try {
    const samples = clusters.map((cluster) => {
      const longest = cluster.reduce((a, b) =>
        b.text!.length > a.text!.length ? b : a,
      );
      return longest.text!.slice(0, MAX_SAMPLE_LENGTH);
    });
    const { json } = await generateJson({
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_TEXT_MODEL,
      prompt: `${VERSIONS_PROMPT}\n\n${samples.map((text, i) => `=== Group ${i + 1} ===\n${text}`).join("\n\n")}`,
      responseJsonSchema: versionsResponseJsonSchema,
      fetch: options.fetch,
    });
    const reply = versionsReplySchema.safeParse(json);
    const listed = reply.success
      ? reply.data.versions.flatMap((v) => v.groups)
      : [];
    if (
      !reply.success ||
      listed.length !== clusters.length ||
      clusters.some((_, i) => !listed.includes(i + 1))
    ) {
      throw new GeminiError("Gemini's versions don't cover every group", true);
    }
    const versions = reply.data.versions.filter((v) => v.groups.length > 0);
    const byPaper = new Map<number, { group: number; label: string }>();
    versions.forEach((version, n) => {
      const label =
        version.label.trim().slice(0, MAX_LABEL_LENGTH) || `Version ${n + 1}`;
      for (const g of version.groups) {
        for (const paper of clusters[g - 1]!) {
          byPaper.set(paper.id, { group: n + 1, label });
        }
      }
    });
    await writeVersions(db, papers, (p) =>
      versions.length > 1 ? (byPaper.get(p.id) ?? oneVersion()) : oneVersion(),
    );
    return "ai";
  } catch (err) {
    console.error(`Sorting exam ${questionId} into versions failed`, err);
    // Rate limited: try again on a later run. Anything else waits for the next
    // change to the exam, keeping the versions it had.
    if (err instanceof GeminiError && err.status === 429) {
      await wait();
    }
    return "ai";
  }
}

/** Most exams one cron run sorts when their texts settle it without the AI. */
const MAX_EXAMS_PER_RUN = 25;

/**
 * The cron's step: sorts pending exams, newest first, until one needs the AI (one
 * call per run, like the text backfill). Returns the exam it asked the AI about.
 */
export async function groupNextVersions(
  db: Database,
  env: VersionsEnv,
  options: { fetch?: Fetcher } = {},
): Promise<number | null> {
  // A literal, as in the partial index: SQLite can't use one for a parameter.
  const pending = await db
    .select({ id: questions.id })
    .from(questions)
    .where(sql`${questions.versionsPending} = 1`)
    .orderBy(desc(questions.id))
    .limit(MAX_EXAMS_PER_RUN);
  for (const { id } of pending) {
    if ((await groupVersions(db, env, id, options)) === "ai") return id;
  }
  return null;
}

// ── Rating older papers ──────────────────────────────────────────────────────

const QUALITY_PROMPT = `The attached PDF was uploaded to a university question bank as an exam question paper. Rate the copy.

quality: ${QUALITY_INSTRUCTIONS}

qualityNote: ${QUALITY_NOTE_INSTRUCTIONS}`;

export const qualityResponseJsonSchema = {
  type: "object",
  properties: {
    quality: { type: "integer", minimum: 0, maximum: 100 },
    qualityNote: { type: "string" },
  },
  required: ["quality", "qualityNote"],
};

const qualityReplySchema = z.object({
  quality: z.number(),
  qualityNote: z.string(),
});

/**
 * The cron's backfill of ratings for papers published before the upload check rated
 * them: one paper per run, midterms' and finals' only, exams with the most copies
 * first (single copies have nothing to be ranked against). A failure is stored in `quality_note`, so the paper
 * isn't tried again, except Gemini's rate limit. Returns the paper it tried.
 */
export async function rateNextPaper(
  db: Database,
  env: VersionsEnv,
  options: { fetch?: Fetcher } = {},
): Promise<number | null> {
  if (!env.GEMINI_API_KEY) return null;
  // Literals, as in `submissions_quality_pending_idx`.
  const [next] = await db.all<{ id: number; fileKey: string }>(sql`
    select s.id, s.file_key as fileKey
    from submissions s
    join questions q on q.id = s.question_id
    join exam_types e on e.id = q.exam_type_id
    where s.status = 'published' and s.quality is null and s.quality_note is null
      and ${versionedExamType}
    order by q.published_count desc, s.id desc
    limit 1`);
  if (!next) return null;

  try {
    const { pdf } = await readPdfForAi(env, next.fileKey, options.fetch);
    const { json } = await generateJsonFromPdf({
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_TEXT_MODEL,
      pdf,
      prompt: QUALITY_PROMPT,
      responseJsonSchema: qualityResponseJsonSchema,
      fetch: options.fetch,
    });
    const reply = qualityReplySchema.safeParse(json);
    if (!reply.success) {
      throw new GeminiError(
        "Gemini's answer doesn't have the expected shape",
        true,
      );
    }
    await saveQuality(
      db,
      next.id,
      cleanQuality(reply.data.quality),
      reply.data.qualityNote,
    );
  } catch (err) {
    console.error(`Rating paper ${next.id} failed`, err);
    if (!(err instanceof GeminiError && err.status === 429)) {
      const message = err instanceof Error ? err.message : String(err);
      await saveQuality(db, next.id, null, `Couldn't rate: ${message}`);
    }
  }
  return next.id;
}
