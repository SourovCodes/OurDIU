import { createMiddleware } from "hono/factory";
import { createDb } from "../db/client";
import { createAuth } from "../lib/auth";
import type { AppEnv } from "../types";

/** Builds per-request dependencies. Cheap: no I/O happens until they are used. */
export const contextMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const db = createDb(c.env.DB);
  c.set("db", db);
  c.set("auth", createAuth(c.env, db));
  await next();
});
