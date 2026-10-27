import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { purgesQuestionBank } from "../src/middleware/purges-question-bank";

// Every route that writes decides whether it clears Cloudflare's copies of the
// question bank's pages (docs/PLAN.md, decision 62): with `purgesQuestionBank` in
// its middleware (most), in its handler, or not at all because visitors see nothing
// new. A new route that writes fails here until it's decided.

/** Other products' routes: their pages aren't shared. */
const OTHER_PRODUCTS = ["/api/v1/admin/routine/", "/api/v1/cover-page/"];

/** Clear the cache in their handler, only when visitors see the change. */
const IN_HANDLER = new Set([
  // When the report hides the paper.
  "POST /api/v1/submissions/:id/reports",
  // Unless it's a dry run (services/merge.ts).
  "POST /api/v1/admin/departments/merge",
  "POST /api/v1/admin/courses/merge",
  "POST /api/v1/admin/semesters/merge",
  "POST /api/v1/admin/exam-types/merge",
]);

/** Change nothing visitors see on the question bank's pages. */
const NO_PURGE = new Set([
  // Counts catch up within the minute (signed in, they're read fresh).
  "POST /api/v1/questions/:id/views",
  "POST /api/v1/submissions/:id/views",
  "PUT /api/v1/submissions/:id/vote",
  "DELETE /api/v1/submissions/:id/vote",
  "POST /api/v1/me/saved",
  "PUT /api/v1/me/saved/:id",
  "DELETE /api/v1/me/saved/:id",
  // Review conversations, the student ID, roles and reports are private.
  "POST /api/v1/me/submissions/:id/messages",
  "POST /api/v1/admin/submissions/:id/messages",
  "PUT /api/v1/me/student-id",
  "PATCH /api/v1/admin/users/:id",
  "PATCH /api/v1/admin/reports/:id",
  // Queue jobs: the AI check purges when it publishes; a watermark made again has
  // its old copy deleted after the cron's purge (services/cache.ts); texts are read
  // within the minute's staleness.
  "POST /api/v1/admin/submissions/:id/analysis",
  "POST /api/v1/admin/submissions/analysis",
  "POST /api/v1/admin/submissions/text",
  "POST /api/v1/admin/submissions/watermark",
  "POST /api/v1/admin/submissions/watermark/all",
  "POST /api/v1/admin/submissions/:id/watermark",
]);

describe("routes that write", () => {
  const routes = createApp().routes.filter(
    (route) =>
      !["GET", "HEAD", "ALL"].includes(route.method) &&
      route.path.startsWith("/api/v1/") &&
      !OTHER_PRODUCTS.some((prefix) => route.path.startsWith(prefix)),
  );
  const purging = new Set(
    routes
      .filter((route) => route.handler === purgesQuestionBank)
      .map((route) => `${route.method} ${route.path}`),
  );
  const writes = [
    ...new Set(routes.map((route) => `${route.method} ${route.path}`)),
  ];

  it("clear the cached pages with purgesQuestionBank unless listed otherwise", () => {
    const undecided = writes.filter(
      (write) =>
        !purging.has(write) && !IN_HANDLER.has(write) && !NO_PURGE.has(write),
    );
    expect(undecided).toEqual([]);
    const both = [...purging].filter(
      (write) => IN_HANDLER.has(write) || NO_PURGE.has(write),
    );
    expect(both).toEqual([]);
  });

  it("are all still there for the lists' entries", () => {
    const missing = [...IN_HANDLER, ...NO_PURGE].filter(
      (write) => !writes.includes(write),
    );
    expect(missing).toEqual([]);
  });
});
