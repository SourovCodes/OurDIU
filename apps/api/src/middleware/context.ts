import { createMiddleware } from "hono/factory";
import { createDb, d1For } from "../db/client";
import { createAuth } from "../lib/auth";
import type { AppEnv } from "../types";

/** Builds per-request dependencies. Cheap: no I/O happens until they are used. */
export const contextMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const db = createDb(d1For(c.env.DB, c.req.raw));
  c.set("db", db);
  c.set("auth", createAuth(c.env, db));
  await next();
});
