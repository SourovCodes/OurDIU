import { createMiddleware } from "hono/factory";
import { AppError } from "../lib/errors";
import type { AppEnv } from "../types";

/**
 * Only protected routes look up the session, so the anonymous majority of
 * traffic never pays for a session query.
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const session = await c.var.auth.api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session) {
    throw new AppError(401, "UNAUTHORIZED", "You must be signed in");
  }
  c.set("session", session);
  await next();
});
