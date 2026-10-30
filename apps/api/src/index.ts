import { createApp } from "./app";
import { createDb } from "./db/client";
import { handleAnalysisBatch, type AnalysisJob } from "./services/analysis";
import { fillCourseAliases } from "./services/course-aliases";
import { hashNextPapers } from "./services/duplicates";
import { readNextMissingText, type TextJob } from "./services/paper-text";
import { refreshTrending } from "./services/trending";
import { groupNextVersions, rateNextPaper } from "./services/versions";
import { handleWatermarkBatch, type WatermarkJob } from "./services/watermark";

const app = createApp();

/**
 * Makes one AI call per run, 288 a day at most. In turn: a missing paper text
 * (services/paper-text.ts, GEMINI_TEXT_MODEL, inside its free quota of about 500
 * requests a day), then an exam to sort into versions (needs its papers' texts), then
 * an older paper to rate (services/versions.ts, GEMINI_MODEL, which tells copies
 * apart better; both are rare once the backlog is done). Before them, it hashes a few
 * older papers' files to find duplicates (services/duplicates.ts, no AI). Must match
 * a cron in wrangler.jsonc.
 */
export const TEXT_CRON = "*/5 * * * *";

/**
 * Fills the short names of courses it hasn't looked at yet
 * (services/course-aliases.ts), hourly: one AI call an hour while any are left, 24 a
 * day at most beside the text backfill's 288. Must match a cron in wrangler.jsonc.
 */
export const ALIASES_CRON = "0 * * * *";

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
  // The crons in wrangler.jsonc: texts, versions and ratings, courses' short names,
  // and "Most viewed today".
  async scheduled(controller, env) {
    if (controller.cron === TEXT_CRON) {
      const db = createDb(env.DB);
      await hashNextPapers(db, env.BUCKET);
      if ((await readNextMissingText(db, env)) !== null) return;
      if ((await groupNextVersions(db, env)) !== null) return;
      await rateNextPaper(db, env);
    } else if (controller.cron === ALIASES_CRON) {
      await fillCourseAliases(createDb(env.DB), env);
    } else {
      await refreshTrending(createDb(env.DB));
    }
  },
} satisfies ExportedHandler<Env, QueueJob>;
