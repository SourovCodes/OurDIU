import { beforeEach, describe, expect, it } from "vitest";
import { api, signIn } from "./helpers";

// The limits in apps/web/wrangler.jsonc, per 60 seconds. Requests count whether or
// not they succeed, so these tests use cheap failing ones (missing ids, empty forms).
const UPLOADS = 5;
const VOTES = 30;
const REPORTS = 10;

async function expectRateLimited(res: Response) {
  expect(res.status).toBe(429);
  expect(res.headers.get("retry-after")).toBe("60");
  const body = await res.json<{ error: { code: string; message: string } }>();
  expect(body.error.code).toBe("RATE_LIMITED");
  expect(body.error.message).toMatch(/wait a minute/);
}

/** Sends `count` requests, expecting none of them to be rate limited. */
async function exhaust(count: number, send: () => Promise<Response>) {
  for (let i = 0; i < count; i++) {
    expect((await send()).status).not.toBe(429);
  }
}

describe("rate limits", () => {
  // The local limiter counts in fixed 60-second windows; a test that runs across
  // the end of one starts again from zero and never reaches the limit.
  beforeEach(async () => {
    const left = 60_000 - (Date.now() % 60_000);
    if (left < 5_000) await new Promise((resolve) => setTimeout(resolve, left));
  });

  it("limits uploads per user", async () => {
    const alice = await signIn();
    const bob = await signIn();
    const upload = (cookie: string) =>
      api("/api/v1/submissions", {
        method: "POST",
        headers: { cookie },
        body: new FormData(),
      });

    await exhaust(UPLOADS, () => upload(alice.cookie));
    await expectRateLimited(await upload(alice.cookie));
    // Other users have their own allowance.
    expect((await upload(bob.cookie)).status).toBe(422);
  });

  it("limits votes per user, liking and unliking together", async () => {
    const { cookie } = await signIn();
    const vote = (method: "PUT" | "DELETE") =>
      api("/api/v1/submissions/999999/vote", {
        method,
        headers: { cookie, "content-type": "application/json" },
        ...(method === "PUT" ? { body: JSON.stringify({ value: 1 }) } : {}),
      });

    await exhaust(VOTES / 2, () => vote("PUT"));
    await exhaust(VOTES / 2, () => vote("DELETE"));
    await expectRateLimited(await vote("PUT"));
  });

  it("limits reports per user", async () => {
    const { cookie } = await signIn();
    const report = () =>
      api("/api/v1/submissions/999999/reports", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ reason: "wrong_details" }),
      });

    await exhaust(REPORTS, report);
    await expectRateLimited(await report());
  });
});
