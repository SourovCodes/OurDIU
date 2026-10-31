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

// ── Rating a copy ────────────────────────────────────────────────────────────

// The AI doesn't score copies: asked for a number, it gave two thirds of them 85.
// It answers fixed checks instead, and `qualityOf` takes points off for each flaw,
// so ratings spread out and mean the same for every paper.

/** The points each answer takes off 100. A copy nobody can read scores 0. */
const COPY_CHECK_POINTS = {
  readable: { all: 0, most: 15, some: 40, none: 100 },
  writing: { none: 0, light: 4, heavy: 12 },
  straight: { flat: 0, slight: 3, strong: 10 },
  light: { even: 0, uneven: 4, poor: 10 },
  missing: { none: 0, edges: 3, content: 25 },
  source: { digital: 0, scan: 2, photo: 4 },
} as const;

type CheckName = keyof typeof COPY_CHECK_POINTS;
const CHECK_NAMES = Object.keys(COPY_CHECK_POINTS) as CheckName[];

/** The checks of the copy, part of the upload check's prompt too. */
export const COPY_CHECK_INSTRUCTIONS = `judging the copy, not the questions:
  - readable: how much of the questions' text is easy to read: "all", "most" (a few words take effort), "some" (parts are hard or impossible to read), "none".
  - writing: handwriting, ticks, underlining or highlighting added on the paper: "none", "light" (a few marks that cover nothing), "heavy" (marks over or between many questions, or answers written on it).
  - straight: "flat" (square to the page), "slight" (a little tilted, skewed or curled), "strong" (clearly at an angle, rotated sideways, or warped).
  - light: "even", "uneven" (shadows, a dark or grey background), "poor" (dark, faded, washed out or with glare that hides text).
  - missing: "none", "edges" (margins or the header cut off, every question complete), "content" (part of a question cut off, or pages or questions missing, judging by the numbering and any page count printed on it).
  - source: "digital" (a PDF made on a computer), "scan" (a scanner or a scanning app's flat, cleaned page), "photo" (a camera photo of the paper).
  - note: a few words on what most affects how readable it is ("Sharp scan", "Photo at an angle, notes over Q2").`;

/** The checks as a JSON schema, for the upload check's and the cron's replies. */
export const copyChecksJsonSchema = {
  type: "object",
  properties: {
    ...Object.fromEntries(
      CHECK_NAMES.map((name) => [
        name,
        { type: "string", enum: Object.keys(COPY_CHECK_POINTS[name]) },
      ]),
    ),
    note: { type: "string" },
  },
  required: [...CHECK_NAMES, "note"],
};

export const copyChecksSchema = z.object({
  readable: z.enum(["all", "most", "some", "none"]),
  writing: z.enum(["none", "light", "heavy"]),
  straight: z.enum(["flat", "slight", "strong"]),
  light: z.enum(["even", "uneven", "poor"]),
  missing: z.enum(["none", "edges", "content"]),
  source: z.enum(["digital", "scan", "photo"]),
  note: z.string(),
});
export type CopyChecks = z.infer<typeof copyChecksSchema>;

/** A copy's rating from its checks: 100 less the points for each flaw, at least 0. */
export function qualityOf(checks: CopyChecks): number {
  const lost = CHECK_NAMES.reduce(
    (sum, name) =>
      sum + (COPY_CHECK_POINTS[name] as Record<string, number>)[checks[name]]!,
    0,
  );
  return Math.max(0, 100 - lost);
}

/**
 * Stores a paper's rating from its checks, or with null checks why rating failed,
 * without touching `updated_at`.
 */
export async function saveRating(
  db: Database,
  submissionId: number,
  checks: CopyChecks | null,
  failure?: string,
): Promise<void> {
  const note = (checks?.note ?? failure)?.trim().slice(0, 200) || null;
  const stored = checks
    ? JSON.stringify(Object.fromEntries(CHECK_NAMES.map((n) => [n, checks[n]])))
    : null;
  await db.run(
    sql`update submissions set quality = ${checks ? qualityOf(checks) : null}, quality_note = ${note}, quality_checks = ${stored} where id = ${submissionId}`,
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

// The first prompt split copies of one paper over transcription mistakes and made up
// labels like "Set B" (a third of the exams it split, checked on 31 October 2026).
// This one says what doesn't make a version, asks for the question that differs
// (a version without one is merged), and allows only printed labels.
const VERSIONS_PROMPT = `Students uploaded these copies of question papers for one exam (the same course, semester and exam type). Each numbered group below holds copies of one paper; you see the text of one copy per group, transcribed by AI from a photo or scan, so it has mistakes.

1. Put together the groups that are the same question paper. The same questions make the same paper, however differently they were transcribed: misread symbols or numbers, a figure described differently, questions numbered differently (4c for 5a), a header or page cut off or missing, handwriting read as text, a different layout. A different version has at least one question that asks something else: another scenario, other values in the question, other questions altogether (sets, sections, batches, a retake, or another course's paper filed here by mistake). When unsure, it is the same paper. List every group number exactly once.
2. For each version, difference: a question it has that the others don't, in a few words ("Q2 uses 5 resistors, not 4", "Q1 is on Huffman coding"). Leave it empty when you can't name one; then it is not a separate version.
3. Label each version in at most 30 characters, telling students how it differs from the others, using only what is printed on its paper: sections ("Sections A-D"), batch ("Batch 62"), a set name, an exam date ("12 Oct"), an exam name ("Class test 2"), a course code. Never make up a set letter, "Retake" or a section that isn't printed, and never use a question number or the marks. If nothing printed differs, name its first question that differs ("Starts with Huffman coding"). Sentence case, without the course name or semester; every label different.`;

const versionsResponseJsonSchema = {
  type: "object",
  properties: {
    versions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          groups: { type: "array", items: { type: "integer" } },
          difference: { type: "string" },
          label: { type: "string" },
        },
        required: ["groups", "difference", "label"],
      },
    },
  },
  required: ["versions"],
};

const versionsReplySchema = z.object({
  versions: z.array(
    z.object({
      groups: z.array(z.number().int()),
      difference: z.string(),
      label: z.string(),
    }),
  ),
});

/**
 * The bindings grouping and rating need: the text backfill's, and the upload check's
 * model, which tells copies and versions apart better than the lighter one.
 */
export type VersionsEnv = TextEnv & { GEMINI_MODEL: string };

type ReplyVersion = z.infer<typeof versionsReplySchema>["versions"][number];

/**
 * The AI's versions as stored: a version it named no difference for joins the one
 * with the most groups, and a label already taken gets its number.
 */
export function settleVersions(
  versions: ReplyVersion[],
): { groups: number[]; label: string }[] {
  const listed = versions.filter((v) => v.groups.length > 0);
  const kept = listed.filter((v) => v.difference.trim());
  const merged = listed.filter((v) => !v.difference.trim());
  if (kept.length < 2) return [];
  const largest = kept.reduce((a, b) =>
    b.groups.length > a.groups.length ? b : a,
  );
  const result = kept.map((v) => ({
    groups: [
      ...v.groups,
      ...(v === largest ? merged.flatMap((m) => m.groups) : []),
    ],
    label: v.label.trim().slice(0, MAX_LABEL_LENGTH),
  }));
  const taken = new Set<string>();
  result.forEach((v, n) => {
    let label = v.label || `Version ${n + 1}`;
    if (taken.has(label.toLowerCase())) label = `${label} (${n + 1})`;
    taken.add(label.toLowerCase());
    v.label = label;
  });
  return result;
}

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
      model: env.GEMINI_MODEL,
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
    const versions = settleVersions(reply.data.versions);
    const byPaper = new Map<number, { group: number; label: string }>();
    versions.forEach(({ groups, label }, n) => {
      for (const g of groups) {
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
    // Rate limited or out of credit: try again on a later run. Anything else waits
    // for the next change to the exam, keeping the versions it had.
    if (err instanceof GeminiError && err.mustWait) {
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

/** The cron's request for a paper's checks (the upload check asks within its own). */
export const RATING_PROMPT = `The attached PDF was uploaded to a university question bank as an exam question paper. Check this copy, ${COPY_CHECK_INSTRUCTIONS}`;

/**
 * The cron's backfill of ratings for papers published before the upload check rated
 * them: one paper per run, midterms' and finals' only, exams with the most copies
 * first (single copies have nothing to be ranked against). A failure is stored in
 * `quality_note`, so the paper isn't tried again, except when Gemini is rate
 * limited or out of credit.
 * Returns the paper it tried.
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
      model: env.GEMINI_MODEL,
      pdf,
      prompt: RATING_PROMPT,
      responseJsonSchema: copyChecksJsonSchema,
      fetch: options.fetch,
    });
    const reply = copyChecksSchema.safeParse(json);
    if (!reply.success) {
      throw new GeminiError(
        "Gemini's answer doesn't have the expected shape",
        true,
      );
    }
    await saveRating(db, next.id, reply.data);
  } catch (err) {
    console.error(`Rating paper ${next.id} failed`, err);
    if (!(err instanceof GeminiError && err.mustWait)) {
      const message = err instanceof Error ? err.message : String(err);
      await saveRating(db, next.id, null, `Couldn't rate: ${message}`);
    }
  }
  return next.id;
}
