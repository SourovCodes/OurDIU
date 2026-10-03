import { createApp } from "./app";
import { createDb } from "./db/client";
import { handleAnalysisBatch, type AnalysisJob } from "./services/analysis";
import { readNextMissingText, type TextJob } from "./services/paper-text";
import { refreshTrending } from "./services/trending";
import { handleWatermarkBatch, type WatermarkJob } from "./services/watermark";

const app = createApp();

/**
 * Reads one missing paper text per run (services/paper-text.ts): 288 a day, inside
 * Gemini's free quota for GEMINI_TEXT_MODEL (about 500 requests a day for Flash-Lite)
 * with room for retries. Must match a cron in wrangler.jsonc.
 */
export const TEXT_CRON = "*/5 * * * *";

/** A message on either queue. */
export type QueueJob = AnalysisJob | TextJob | WatermarkJob;

// Not a Worker of its own: apps/web's Worker serves this under /api/* and runs the
// queue and cron handlers (apps/web/workers/app.ts, which also holds the wrangler
// config).
export default {
  fetch: app.fetch,
  // One consumer per queue in wrangler.jsonc.
  async queue(batch, env) {
    if (batch.queue === "questions-watermark") {
      await handleWatermarkBatch(batch as MessageBatch<WatermarkJob>, env);
    } else {
      await handleAnalysisBatch(
        batch as MessageBatch<AnalysisJob | TextJob>,
        env,
      );
    }
  },
  // The crons in wrangler.jsonc: the text backfill, and "Most viewed today".
  async scheduled(controller, env) {
    if (controller.cron === TEXT_CRON) {
      await readNextMissingText(createDb(env.DB), env);
    } else {
      await refreshTrending(createDb(env.DB));
    }
  },
} satisfies ExportedHandler<Env, QueueJob>;
