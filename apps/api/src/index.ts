import { createApp } from "./app";
import { handleAnalysisBatch, type AnalysisJob } from "./services/analysis";
import type { TextJob } from "./services/paper-text";
import { handleWatermarkBatch, type WatermarkJob } from "./services/watermark";

const app = createApp();

/** A message on either queue. */
export type QueueJob = AnalysisJob | TextJob | WatermarkJob;

// Not a Worker of its own: apps/web's Worker serves this under /api/* and runs the
// queue handler (apps/web/workers/app.ts, which also holds the wrangler config).
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
} satisfies ExportedHandler<Env, QueueJob>;
