import { createMiddleware } from "hono/factory";
import { AppError } from "../lib/errors";
import type { AppEnv } from "../types";

/** Like `requireAuth`, but only lets admins through. */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const session = await c.var.auth.api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session) {
    throw new AppError(401, "UNAUTHORIZED", "You must be signed in");
  }
  if (session.user.role !== "admin") {
    throw new AppError(403, "FORBIDDEN", "Only admins can do this");
  }
  c.set("session", session);
  await next();
});
