import type { DepartmentList } from "@ourdiu/shared";
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { FRESH_MS } from "../src/middleware/public-cache";
import { ORIGIN, seedTaxonomy, signIn } from "./helpers";

// The cache is off in tests (wrangler.jsonc), so these switch it on for their
// own app.
const app = createApp();
const cachedEnv = { ...env, PUBLIC_CACHE: "on" };

function get(path: string, init: RequestInit = {}) {
  return app.fetch(new Request(`${ORIGIN}${path}`, init), cachedEnv);
}

async function departmentNames(res: Response) {
  return (await res.json<DepartmentList>()).items.map((d) => d.name);
}

/** Polls until the background refresh has stored a newer copy. */
async function refreshed(path: string, since: number) {
  for (let i = 0; i < 50; i++) {
    const hit = await caches.default.match(new URL(path, env.SITE_URL).href);
    if (Number(hit?.headers.get("x-cached-at")) > since) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`${path} was not refreshed`);
}

afterEach(() => vi.restoreAllMocks());

describe("public cache", () => {
  it("answers anonymous public reads from the cache", async () => {
    await seedTaxonomy();
    const path = "/api/v1/semesters";
    const first = await get(path);
    expect(first.headers.get("x-cache")).toBe("MISS");
    const second = await get(path);
    expect(second.headers.get("x-cache")).toBe("HIT");
    expect(await second.json()).toEqual(await first.json());
    // The cache's own bookkeeping never reaches visitors.
    expect(second.headers.get("x-cached-at")).toBeNull();
    expect(second.headers.get("cache-control")).toBeNull();
  });

  it("shares one entry whatever the order of the query", async () => {
    await get("/api/v1/questions?sort=newest&pageSize=5");
    const res = await get("/api/v1/questions?pageSize=5&sort=newest");
    expect(res.headers.get("x-cache")).toBe("HIT");
  });

  it("serves a stale copy while it fetches a fresh one", async () => {
    const path = "/api/v1/departments";
    await get(path);
    const before = await departmentNames(await get(path));
    const { cse } = await seedTaxonomy();
    const cachedAt = Date.now();

    vi.spyOn(Date, "now").mockReturnValue(cachedAt + FRESH_MS + 1);
    const stale = await get(path);
    expect(stale.headers.get("x-cache")).toBe("STALE");
    expect(await departmentNames(stale)).toEqual(before);
    await refreshed(path, cachedAt);

    const fresh = await get(path);
    expect(fresh.headers.get("x-cache")).toBe("HIT");
    expect(await departmentNames(fresh)).toContain(cse.name);
  });

  it("never caches signed-in visitors, writes or private routes", async () => {
    const { cookie } = await signIn();
    const signedIn = await get("/api/v1/courses", { headers: { cookie } });
    expect(signedIn.headers.get("x-cache")).toBeNull();
    const app = await get("/api/v1/courses", {
      headers: { authorization: "Bearer token" },
    });
    expect(app.headers.get("x-cache")).toBeNull();
    const mine = await get("/api/v1/me/saved", { headers: { cookie } });
    expect(mine.headers.get("x-cache")).toBeNull();
    const health = await get("/api/v1/health");
    expect(health.headers.get("x-cache")).toBeNull();
  });

  it("doesn't keep errors", async () => {
    const path = "/api/v1/questions/999999999";
    expect((await get(path)).status).toBe(404);
    const again = await get(path);
    expect(again.status).toBe(404);
    expect(again.headers.get("x-cache")).toBe("MISS");
  });

  it("is off unless PUBLIC_CACHE is on", async () => {
    const res = await app.fetch(
      new Request(`${ORIGIN}/api/v1/exam-types`),
      env,
    );
    expect(res.headers.get("x-cache")).toBeNull();
  });
});
