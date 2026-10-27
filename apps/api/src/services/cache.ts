import { QUESTION_BANK_CACHE_TAG } from "@ourdiu/shared/constants";
import { asc, lte } from "drizzle-orm";
import type { Database } from "../db/client";
import { pendingCachePurges } from "../db/schema";
import { workersCache } from "../lib/cache";

// Clears Cloudflare's copies of the question bank's shared responses (Workers Cache,
// docs/PLAN.md, decision 62) after a change visitors would see: a paper published,
// taken down or filed elsewhere, a new upload under review, the catalog edited. One
// tag for all of them: copies are fresh for a minute anyway, so clearing more than
// the change touched costs a cache miss per page at most. Cloudflare allows few
// purges (5 a minute, bursts of 25) and keeps stale copies for a day (served once
// while they refresh), so a refused purge is noted and made again by the cron.
// Votes and views don't clear anything; their counts catch up within the minute.

/** Whether Cloudflare cleared `tags` (or keeps nothing, with caching off). */
async function purged(tags: string[]) {
  try {
    const result = await workersCache.purge({ tags });
    if (!result || result.success) return true;
    console.warn("Cache purge refused", result.errors);
  } catch (err) {
    console.warn("Cache purge failed", err);
  }
  return false;
}

/**
 * Clears the question bank's shared responses, or, when Cloudflare refuses, notes it
 * for the cron (`runPendingPurges`). Never fails the change that asked.
 */
export async function purgeQuestionBank(db: Database) {
  if (await purged([QUESTION_BANK_CACHE_TAG])) return;
  await db
    .insert(pendingCachePurges)
    .values({ tag: QUESTION_BANK_CACHE_TAG })
    .catch((err) => console.error("Couldn't note the cache purge", err));
}

/**
 * Deletes an R2 file that shared copies may still link to, after the cron's next
 * purge: a watermarked copy made again. Re-watermarking every paper so costs one
 * purge every five minutes rather than one per paper.
 */
export async function deleteAfterPurge(db: Database, fileKey: string) {
  await db
    .insert(pendingCachePurges)
    .values({ tag: QUESTION_BANK_CACHE_TAG, fileKey });
}

/** How many noted purges one run handles (R2 deletes up to 1000 keys at once). */
const PURGE_BATCH = 1000;

/**
 * The cron's part: one purge for the noted ones, then their files deleted. Left for
 * the next run while Cloudflare still refuses.
 */
export async function runPendingPurges(db: Database, bucket: R2Bucket) {
  const pending = await db
    .select()
    .from(pendingCachePurges)
    .orderBy(asc(pendingCachePurges.id))
    .limit(PURGE_BATCH);
  if (pending.length === 0) return;
  if (!(await purged([...new Set(pending.map((row) => row.tag))]))) return;
  const keys = pending.flatMap((row) => (row.fileKey ? [row.fileKey] : []));
  if (keys.length > 0) await bucket.delete(keys);
  await db
    .delete(pendingCachePurges)
    .where(lte(pendingCachePurges.id, pending.at(-1)!.id));
}
