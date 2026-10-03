import { and, asc, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { createDb, type Database } from "../db/client";
import { submissions, submissionTexts } from "../db/schema";
import { PermanentError, readPdfForAi } from "../lib/ai-pdf";
import { GeminiError, generateJsonFromPdf } from "../lib/gemini";
import type { Fetcher } from "../lib/pdf-processor";

// Papers' text, read off the PDF by the AI: the upload check reads it in the same call
// (analysis.ts), and the backfill reads it for papers published before that: a cron
// reads one paper at a time (`readNextMissingText`), slowly enough to stay inside
// Gemini's free daily quota, and admins can queue them all at once
// (`readMissingTexts`). Only published papers' text is served (questions.ts) and
// searched (paper-search.ts).

/** Longest text kept; a file of several papers can run long. */
export const MAX_TEXT_LENGTH = 30_000;

/** How the AI writes a paper's text; part of the upload check's prompt too. */
export const TEXT_INSTRUCTIONS = `the full text of the question paper, transcribed exactly as printed, in reading order: the header (university, department, course code and title, exam, semester, time, full marks), any instructions, then every question with its number, sub-parts and marks.
  - Keep the original language and wording. Don't answer, solve, summarize, translate or correct anything.
  - Plain text, one line per heading, question or sub-part, and a blank line between questions.
  - Write mathematics in plain text (x^2, sqrt(x), (a+b)/c, ≤, ∑, ∫), and tables as lines with " | " between cells.
  - For figures, diagrams, graphs and circuit drawings write [Figure: a short description].
  - Leave out handwriting, stamps, watermarks and page numbers.
  - Use an empty string if the file isn't a question paper or nothing is readable.`;

const TEXT_PROMPT = `The attached PDF was uploaded to a university question bank as an exam question paper.

Answer with text: ${TEXT_INSTRUCTIONS}`;

const textResponseJsonSchema = {
  type: "object",
  properties: { text: { type: "string" } },
  required: ["text"],
};
const textReplySchema = z.object({ text: z.string() });

/** The message on the analysis queue that reads a published paper's text. */
export type TextJob = { kind: "text"; submissionId: number };

/** First delivery plus `max_retries` (3) of the analysis queue's consumer. */
export const TEXT_MAX_ATTEMPTS = 4;

/** Queue `sendBatch` takes at most 100 messages. */
const QUEUE_BATCH_SIZE = 100;

/** Tidies the AI's text: trimmed lines, at most one blank line in a row, capped. */
export function cleanText(text: string): string | null {
  const cleaned = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!cleaned) return null;
  return cleaned.length > MAX_TEXT_LENGTH
    ? cleaned.slice(0, MAX_TEXT_LENGTH)
    : cleaned;
}

/** Stores the outcome of a read: the text, or why it failed. */
export async function saveText(
  db: Database,
  submissionId: number,
  result: { text: string | null; error: string | null; model: string | null },
): Promise<void> {
  await db
    .insert(submissionTexts)
    .values({ submissionId, ...result })
    .onConflictDoUpdate({
      target: submissionTexts.submissionId,
      set: { ...result, updatedAt: new Date() },
    });
}

/**
 * Admin backfill: queues every published paper whose text was never read, or whose
 * read failed. Returns how many were queued.
 */
export async function readMissingTexts(
  db: Database,
  queue: Queue<TextJob>,
): Promise<number> {
  const rows = await db
    .select({ id: submissions.id })
    .from(submissions)
    .leftJoin(submissionTexts, eq(submissionTexts.submissionId, submissions.id))
    .where(
      and(
        eq(submissions.status, "published"),
        or(
          isNull(submissionTexts.submissionId),
          isNotNull(submissionTexts.error),
        ),
      ),
    )
    .orderBy(submissions.id);
  const ids = rows.map((row) => row.id);
  for (let i = 0; i < ids.length; i += QUEUE_BATCH_SIZE) {
    const chunk = ids.slice(i, i + QUEUE_BATCH_SIZE);
    try {
      await queue.sendBatch(
        chunk.map((submissionId) => ({
          body: { kind: "text" as const, submissionId },
        })),
      );
    } catch (err) {
      console.error("Couldn't queue the text reads", err);
      // Marked failed, so the next backfill picks them up again.
      for (const submissionId of chunk) {
        await saveText(db, submissionId, {
          text: null,
          error: "Couldn't queue the read",
          model: null,
        });
      }
    }
  }
  return ids.length;
}

/** The bindings a read needs (vars widened to plain strings, for tests). */
export type TextEnv = {
  BUCKET: R2Bucket;
  GEMINI_API_KEY: string;
  /** A lighter model than the upload check's, with a free quota of its own. */
  GEMINI_TEXT_MODEL: string;
  COMPRESSOR_API_KEY: string;
  PDF_PROCESSOR_URL: string;
};

/**
 * Reads one published paper's text. Papers that were unpublished or already have
 * their text (the upload check read it meanwhile) are skipped. Returns "retry" when a
 * later attempt might succeed; the failure is stored after the last attempt. `once`
 * (the cron) stores any failure straight away except Gemini's rate limit, which
 * leaves the paper for the next try.
 */
export async function runTextRead(
  db: Database,
  env: TextEnv,
  job: TextJob,
  options: { attempt?: number; once?: boolean; fetch?: Fetcher } = {},
): Promise<"done" | "retry"> {
  const attempt = options.attempt ?? 1;
  const [row] = await db
    .select({ fileKey: submissions.fileKey, text: submissionTexts.text })
    .from(submissions)
    .leftJoin(submissionTexts, eq(submissionTexts.submissionId, submissions.id))
    .where(
      and(
        eq(submissions.id, job.submissionId),
        eq(submissions.status, "published"),
      ),
    );
  if (!row || row.text !== null) return "done";

  try {
    if (!env.GEMINI_API_KEY) {
      throw new PermanentError(
        "AI analysis isn't configured (GEMINI_API_KEY is missing)",
      );
    }
    const { pdf } = await readPdfForAi(env, row.fileKey, options.fetch);
    const { json } = await generateJsonFromPdf({
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_TEXT_MODEL,
      pdf,
      prompt: TEXT_PROMPT,
      responseJsonSchema: textResponseJsonSchema,
      fetch: options.fetch,
    });
    const reply = textReplySchema.safeParse(json);
    if (!reply.success) {
      throw new GeminiError(
        "Gemini's answer doesn't have the expected shape",
        true,
      );
    }
    await saveText(db, job.submissionId, {
      text: cleanText(reply.data.text),
      error: null,
      model: env.GEMINI_TEXT_MODEL,
    });
    return "done";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const retryable =
      !(err instanceof PermanentError) &&
      !(err instanceof GeminiError && !err.retryable);
    const rateLimited = err instanceof GeminiError && err.status === 429;
    const final = options.once
      ? !rateLimited
      : !retryable || attempt >= TEXT_MAX_ATTEMPTS;
    console.error(
      `Reading the text of ${job.submissionId} failed (attempt ${attempt})`,
      err,
    );
    if (final) {
      await saveText(db, job.submissionId, {
        text: null,
        error: message,
        model: env.GEMINI_TEXT_MODEL,
      });
    }
    return final ? "done" : "retry";
  }
}

/** How long a failed read waits before the cron tries it again. */
export const TEXT_RETRY_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The paper the cron reads next: a published paper whose text was never read, oldest
 * first, then one whose read failed over a week ago (least recently tried first).
 */
export async function nextMissingText(
  db: Database,
  now = new Date(),
): Promise<number | null> {
  const [row] = await db
    .select({ id: submissions.id })
    .from(submissions)
    .leftJoin(submissionTexts, eq(submissionTexts.submissionId, submissions.id))
    .where(
      and(
        eq(submissions.status, "published"),
        or(
          isNull(submissionTexts.submissionId),
          and(
            isNotNull(submissionTexts.error),
            lt(
              submissionTexts.updatedAt,
              new Date(now.getTime() - TEXT_RETRY_AFTER_MS),
            ),
          ),
        ),
      ),
    )
    .orderBy(
      sql`${submissionTexts.submissionId} is not null`,
      asc(submissionTexts.updatedAt),
      asc(submissions.id),
    )
    .limit(1);
  return row?.id ?? null;
}

/**
 * The cron's backfill: reads one missing text per run, so the schedule
 * (`TEXT_CRON` in index.ts) sets the pace against Gemini's free daily quota. Does
 * nothing without an API key (locally, in tests), so no failures are stored.
 * Returns the paper it tried.
 */
export async function readNextMissingText(
  db: Database,
  env: TextEnv,
  options: { fetch?: Fetcher; now?: Date } = {},
): Promise<number | null> {
  if (!env.GEMINI_API_KEY) return null;
  const submissionId = await nextMissingText(db, options.now);
  if (submissionId === null) return null;
  await runTextRead(
    db,
    env,
    { kind: "text", submissionId },
    { once: true, fetch: options.fetch },
  );
  return submissionId;
}

/** Queue consumer for text reads, alongside the analyses (`handleAnalysisBatch`). */
export async function handleTextMessage(
  message: Message<TextJob>,
  env: Env,
): Promise<void> {
  const outcome = await runTextRead(createDb(env.DB), env, message.body, {
    attempt: message.attempts,
  });
  if (outcome === "retry") {
    message.retry({ delaySeconds: 30 * message.attempts });
  } else {
    message.ack();
  }
}
