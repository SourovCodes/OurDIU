import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function createDb(d1: D1Database | D1DatabaseSession) {
  // Drizzle's types only take a D1Database, but all it calls is `prepare` and
  // `batch`, which a read-replication session has too.
  return drizzle(d1 as D1Database, { schema, casing: "snake_case" });
}

export type Database = ReturnType<typeof createDb>;

/** Better Auth's session cookie, with or without the `__Secure-` prefix. */
const SESSION_COOKIE = "better-auth.session_token=";

/**
 * Where a request's queries go, with D1's read replication (docs/PLAN.md,
 * decision 45). Anonymous reads go to the nearest copy, which may trail the
 * primary by a moment; nobody writes without signing in, so they never miss a
 * change of their own. Writes, sign-in and everyone signed in (cookie or the
 * app's bearer token) use the primary first, so they always see their own
 * changes.
 */
export function d1For(d1: D1Database, request: Request) {
  const anonymousRead =
    (request.method === "GET" || request.method === "HEAD") &&
    !new URL(request.url).pathname.startsWith("/api/auth/") &&
    !request.headers.get("authorization") &&
    !request.headers.get("cookie")?.includes(SESSION_COOKIE);
  return d1.withSession(
    anonymousRead ? "first-unconstrained" : "first-primary",
  );
}
