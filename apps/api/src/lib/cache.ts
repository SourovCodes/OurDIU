import { QUESTION_BANK_CACHE_TAG } from "@ourdiu/shared/constants";

// Clears Cloudflare's copies of the question bank's shared responses (Workers Cache,
// docs/PLAN.md, decision 62) after a change visitors would see: a paper published,
// taken down, filed elsewhere or watermarked again, a new upload under review, the
// catalog edited. One tag for all of them: copies are kept a minute anyway, so
// clearing more than the change touched costs a cache miss per page at most, and
// Cloudflare allows few purges (5 a minute, bursts of 25). Votes and views don't
// clear anything; their counts catch up within the minute.

/** Workers Cache's purge; tests replace it (with caching off there is none). */
export const workersCache = {
  async purge(options: CachePurgeOptions): Promise<CachePurgeResult | null> {
    // Loaded here, not at the top: the OpenAPI export (scripts/) runs the app in Node.
    const { cache } = await import("cloudflare:workers");
    // Without caching (turned off, local dev) Workers have no purge().
    return typeof cache?.purge === "function" ? cache.purge(options) : null;
  },
};

/** Clears the question bank's shared responses; never fails the change that asked. */
export async function purgeQuestionBank() {
  try {
    const result = await workersCache.purge({
      tags: [QUESTION_BANK_CACHE_TAG],
    });
    // Rate limited, most likely: the copies expire within the minute anyway.
    if (result && !result.success) {
      console.warn("Cache purge failed", result.errors);
    }
  } catch (err) {
    console.warn("Cache purge failed", err);
  }
}
