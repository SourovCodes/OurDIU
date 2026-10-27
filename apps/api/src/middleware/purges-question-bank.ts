import { createMiddleware } from "hono/factory";
import { purgeQuestionBank } from "../services/cache";
import type { AppEnv } from "../types";

/**
 * For routes whose changes visitors see on the question bank's pages: once the
 * change succeeded, clears Cloudflare's copies of them (services/cache.ts) before
 * answering, so the page the caller opens next shows it.
 */
export const purgesQuestionBank = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  if (c.res.ok) await purgeQuestionBank(c.var.db);
});
