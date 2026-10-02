import type { SubmissionWatermark } from "@ourdiu/shared";
import { and, eq, isNull, or } from "drizzle-orm";
import { createDb, type Database } from "../db/client";
import { inList } from "../db/in-list";
import { submissions, user } from "../db/schema";
import { AppError } from "../lib/errors";
import {
  PdfProcessorError,
  watermarkPdf,
  type Fetcher,
} from "../lib/pdf-processor";

// Published papers get a public copy with a credit line on top of every page and the
// site's domain stamped faintly across it (compressed by the same call). The original stays untouched for admins and the uploader; the
// public gets it only until the copy is ready.

/** The queue message. */
export type WatermarkJob = { submissionId: number };

/** First delivery plus `max_retries` (3) of the consumer in wrangler.jsonc. */
export const WATERMARK_MAX_ATTEMPTS = 4;

/** The PDF processor's limits on `credit_text` and `watermark_text`. */
const MAX_CREDIT_LENGTH = 255;
const MAX_STAMP_LENGTH = 100;

/** Queue `sendBatch` takes at most 100 messages. */
const QUEUE_BATCH_SIZE = 100;

/**
 * R2 key for a new watermarked copy. Random, like the originals' keys: the bucket is
 * public, so keys must not be guessable from submission ids.
 */
const newWatermarkedFileKey = () => `watermarked/${crypto.randomUUID()}.pdf`;

/** Every R2 object of a submission, for deleting them together. */
export const submissionFileKeys = (row: {
  fileKey: string;
  watermarkedFileKey: string | null;
}) => [
  row.fileKey,
  ...(row.watermarkedFileKey ? [row.watermarkedFileKey] : []),
];

/**
 * The processor draws the text with a standard PDF font, so anything outside ASCII
 * comes out garbled: accents are dropped ("José" → "Jose") and other characters
 * removed.
 */
const toAscii = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * The credit line: the site's domain, and the contributor when their account still
 * exists and their name has Latin letters.
 */
export function creditText(
  siteUrl: string,
  uploaderName: string | null,
): string {
  const site = new URL(siteUrl).host;
  const name = toAscii(uploaderName ?? "");
  if (!/[a-z]/i.test(name)) return `Downloaded from ${site}`;
  const prefix = `${site} | Shared by `;
  const room = MAX_CREDIT_LENGTH - prefix.length;
  return prefix + (name.length > room ? `${name.slice(0, room - 3)}...` : name);
}

/** The faint stamps scattered over every page: the site's domain. */
export const stampText = (siteUrl: string) =>
  toAscii(new URL(siteUrl).host).slice(0, MAX_STAMP_LENGTH);

/**
 * Marks submissions queued and sends them to the watermark queue. Never throws for
 * queue failures: they're marked failed so an admin can retry, and whatever
 * triggered it (a publish) still succeeds.
 */
export async function enqueueWatermarks(
  db: Database,
  queue: Queue<WatermarkJob>,
  ids: number[],
): Promise<void> {
  for (let i = 0; i < ids.length; i += QUEUE_BATCH_SIZE) {
    const chunk = ids.slice(i, i + QUEUE_BATCH_SIZE);
    await db
      .update(submissions)
      .set({ watermarkStatus: "queued", watermarkError: null })
      .where(inList(submissions.id, chunk));
    try {
      await queue.sendBatch(
        chunk.map((submissionId) => ({ body: { submissionId } })),
      );
    } catch (err) {
      console.error("Couldn't queue the watermarks", err);
      await db
        .update(submissions)
        .set({
          watermarkStatus: "failed",
          watermarkError: "Couldn't queue the watermark",
        })
        .where(inList(submissions.id, chunk));
    }
  }
}

/** Queues a submission that was just published, unless it has (or awaits) a copy. */
export async function watermarkIfMissing(
  db: Database,
  queue: Queue<WatermarkJob>,
  id: number,
): Promise<void> {
  const submission = await db.query.submissions.findFirst({
    columns: { watermarkStatus: true },
    where: eq(submissions.id, id),
  });
  if (submission && needsWatermark(submission.watermarkStatus)) {
    await enqueueWatermarks(db, queue, [id]);
  }
}

const needsWatermark = (status: string | null) =>
  status === null || status === "failed";

/**
 * Admin backfill: queues every published paper without a copy, including failed
 * ones. Returns how many were queued.
 */
export async function watermarkMissing(
  db: Database,
  queue: Queue<WatermarkJob>,
): Promise<number> {
  const rows = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(
      and(
        eq(submissions.status, "published"),
        or(
          isNull(submissions.watermarkStatus),
          eq(submissions.watermarkStatus, "failed"),
        ),
      ),
    );
  await enqueueWatermarks(
    db,
    queue,
    rows.map((row) => row.id),
  );
  return rows.length;
}

/**
 * Admin action: makes every published paper's copy again, e.g. after the stamps
 * changed. Current copies stay public until their replacements are ready. Returns
 * how many were queued.
 */
export async function rewatermarkAll(
  db: Database,
  queue: Queue<WatermarkJob>,
): Promise<number> {
  const rows = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(eq(submissions.status, "published"));
  await enqueueWatermarks(
    db,
    queue,
    rows.map((row) => row.id),
  );
  return rows.length;
}

/** Admin action: makes the copy again, e.g. after the contributor renamed themselves. */
export async function rewatermark(
  db: Database,
  queue: Queue<WatermarkJob>,
  id: number,
): Promise<SubmissionWatermark> {
  const submission = await db.query.submissions.findFirst({
    columns: { status: true },
    where: eq(submissions.id, id),
  });
  if (!submission) throw new AppError(404, "NOT_FOUND", "Submission not found");
  if (submission.status !== "published") {
    throw new AppError(
      409,
      "NOT_PUBLISHED",
      "Only published papers get a watermarked copy.",
    );
  }
  await enqueueWatermarks(db, queue, [id]);
  const row = (await db.query.submissions.findFirst({
    columns: {
      watermarkStatus: true,
      watermarkError: true,
      watermarkedFileSize: true,
    },
    where: eq(submissions.id, id),
  }))!;
  return {
    status: row.watermarkStatus!,
    error: row.watermarkError,
    fileSize: row.watermarkedFileSize,
  };
}

/** The bindings a watermark run needs (vars widened to plain strings, for tests). */
export type WatermarkEnv = {
  BUCKET: R2Bucket;
  COMPRESSOR_API_KEY: string;
  PDF_PROCESSOR_URL: string;
  SITE_URL: string;
};

/**
 * Makes and stores the watermarked copy of one submission. Returns "retry" when a
 * later attempt might succeed; it's marked failed after the last attempt.
 */
export async function runWatermark(
  db: Database,
  env: WatermarkEnv,
  job: WatermarkJob,
  options: { attempt?: number; fetch?: Fetcher } = {},
): Promise<"done" | "retry"> {
  const attempt = options.attempt ?? 1;
  const [row] = await db
    .select({
      fileKey: submissions.fileKey,
      previousKey: submissions.watermarkedFileKey,
      uploaderName: user.name,
    })
    .from(submissions)
    .leftJoin(user, eq(user.id, submissions.uploaderId))
    .where(eq(submissions.id, job.submissionId));
  // Deleted in the meantime.
  if (!row) return "done";

  const fail = (error: string) =>
    db
      .update(submissions)
      .set({ watermarkStatus: "failed", watermarkError: error })
      .where(eq(submissions.id, job.submissionId));

  if (!env.COMPRESSOR_API_KEY) {
    await fail("Watermarking isn't configured (COMPRESSOR_API_KEY is missing)");
    return "done";
  }
  try {
    const object = await env.BUCKET.get(row.fileKey);
    if (!object) {
      throw new PdfProcessorError("The PDF is missing from storage", false);
    }
    const pdf = await watermarkPdf(
      new Uint8Array(await object.arrayBuffer()),
      {
        credit: creditText(env.SITE_URL, row.uploaderName),
        stamp: stampText(env.SITE_URL),
      },
      {
        url: env.PDF_PROCESSOR_URL,
        apiKey: env.COMPRESSOR_API_KEY,
        fetch: options.fetch,
      },
    );
    const key = newWatermarkedFileKey();
    await env.BUCKET.put(key, pdf, {
      httpMetadata: { contentType: "application/pdf" },
    });
    const updated = await db
      .update(submissions)
      .set({
        watermarkedFileKey: key,
        watermarkedFileSize: pdf.byteLength,
        watermarkStatus: "done",
        watermarkError: null,
      })
      .where(eq(submissions.id, job.submissionId))
      .returning({ id: submissions.id });
    // Deleted while we were working: don't leave the copy behind.
    if (updated.length === 0) await env.BUCKET.delete(key);
    // Made again (e.g. after a rename): the old copy is replaced.
    else if (row.previousKey) await env.BUCKET.delete(row.previousKey);
    return "done";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const retryable = !(err instanceof PdfProcessorError) || err.retryable;
    const final = !retryable || attempt >= WATERMARK_MAX_ATTEMPTS;
    console.error(
      `Watermarking ${job.submissionId} failed (attempt ${attempt})`,
      err,
    );
    if (final) await fail(message);
    return final ? "done" : "retry";
  }
}

/** Queue consumer: one watermark per message. */
export async function handleWatermarkBatch(
  batch: MessageBatch<WatermarkJob>,
  env: Env,
) {
  const db = createDb(env.DB);
  for (const message of batch.messages) {
    const outcome = await runWatermark(db, env, message.body, {
      attempt: message.attempts,
    });
    if (outcome === "retry") {
      message.retry({ delaySeconds: 30 * message.attempts });
    } else {
      message.ack();
    }
  }
}
