import { createMiddleware } from "hono/factory";
import { errorBody } from "../lib/errors";
import type { AppEnv } from "../types";

type LimiterBinding = {
  [K in keyof Env]: Env[K] extends RateLimit ? K : never;
}[keyof Env];

/**
 * Rejects a request with 429 once the signed-in user has used up the limiter's
 * allowance (limits are in apps/web/wrangler.jsonc, all per 60 seconds). Goes after
 * `requireAuth`. Limits are per user, never per IP address: most visitors share a
 * few campus addresses.
 */
export function rateLimit(binding: LimiterBinding, message: string) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const key = c.var.session?.user.id;
    if (key) {
      const { success } = await c.env[binding].limit({ key });
      if (!success) {
        return c.json(errorBody("RATE_LIMITED", message), 429, {
          "Retry-After": "60",
        });
      }
    }
    await next();
  });
}
