import { waitUntil } from "cloudflare:workers";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";

/**
 * Public reads answered from Cloudflare's cache in the visitor's own data centre
 * (docs/PLAN.md, decision 46). These routes are session-free and set no cookies,
 * so every anonymous visitor gets the same response. Files and PDFs aren't here.
 */
const CACHEABLE = [
  /^\/api\/v1\/(taxonomy|departments|courses|courses\/trending|semesters|exam-types|sitemap)$/,
  /^\/api\/v1\/merged\/[^/]+\/[^/]+$/,
  /^\/api\/v1\/questions(\/[^/]+)?$/,
  /^\/api\/v1\/contributors(\/[^/]+)?$/,
  /^\/api\/v1\/routine\/[^/]+\/(sections|teachers)(\/[^/]+)?$/,
  /^\/api\/v1\/app\/android$/,
];

/** Served as it is for this long, */
export const FRESH_MS = 60_000;
/** then for up to this much longer while a fresh copy is fetched in the background. */
export const STALE_MS = 24 * 60 * 60_000;

const CACHED_AT = "x-cached-at";
/** The response's own Cache-Control, kept while the stored copy carries the cache's. */
const OWN_CACHE_CONTROL = "x-own-cache-control";
/** Better Auth's session cookie, with or without the `__Secure-` prefix. */
const SESSION_COOKIE = "better-auth.session_token=";

/** Requests made by a background refresh: they skip the lookup and store. */
const refreshes = new WeakSet<Request>();
/** Keys being refreshed by this isolate, so a burst of visitors starts one. */
const refreshing = new Set<string>();

/** Workers' cache for this data centre. (The web package type-checks this file
 * with the DOM's CacheStorage, which has no `default`.) */
const edgeCache = () => (caches as unknown as { default: Cache }).default;

function cacheable(request: Request) {
  if (request.method !== "GET") return false;
  // Signed in (cookie or the app's bearer token): always fresh, so people see
  // their own changes at once.
  if (request.headers.get("authorization")) return false;
  if (request.headers.get("cookie")?.includes(SESSION_COOKIE)) return false;
  const { pathname } = new URL(request.url);
  return CACHEABLE.some((pattern) => pattern.test(pathname));
}

/** One entry per path and query, whichever host (diuqbank.com, the app) asked. */
function cacheKey(siteUrl: string, request: Request) {
  const url = new URL(request.url);
  url.searchParams.sort();
  return new Request(new URL(url.pathname + url.search, siteUrl));
}

async function store(key: Request, response: Response) {
  const headers = new Headers(response.headers);
  const own = headers.get("cache-control");
  if (own) headers.set(OWN_CACHE_CONTROL, own);
  headers.set(
    "cache-control",
    `public, max-age=${Math.ceil((FRESH_MS + STALE_MS) / 1000)}`,
  );
  headers.set(CACHED_AT, String(Date.now()));
  headers.delete("x-cache");
  await edgeCache().put(
    key,
    new Response(response.body, { status: response.status, headers }),
  );
}

/** The stored copy as the route itself would have answered, marked HIT or STALE. */
function served(hit: Response, state: "HIT" | "STALE") {
  const response = new Response(hit.body, hit);
  const own = response.headers.get(OWN_CACHE_CONTROL);
  if (own) response.headers.set("cache-control", own);
  else response.headers.delete("cache-control");
  response.headers.delete(OWN_CACHE_CONTROL);
  response.headers.delete(CACHED_AT);
  response.headers.set("x-cache", state);
  return response;
}

/**
 * Caches anonymous public reads when `PUBLIC_CACHE` is "on" (production only).
 * `refetch` runs a request through the app again, for background refreshes.
 */
export function publicCache(
  refetch: (request: Request, env: Env) => Promise<Response>,
) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const request = c.req.raw;
    if (c.env.PUBLIC_CACHE !== "on" || !cacheable(request)) return next();
    const key = cacheKey(c.env.SITE_URL, request);

    if (!refreshes.has(request)) {
      const hit = await edgeCache().match(key);
      if (hit) {
        const age = Date.now() - Number(hit.headers.get(CACHED_AT));
        if (age < FRESH_MS) return served(hit, "HIT");
        if (!refreshing.has(key.url)) {
          refreshing.add(key.url);
          const refresh = new Request(key.url);
          refreshes.add(refresh);
          waitUntil(
            refetch(refresh, c.env).finally(() => refreshing.delete(key.url)),
          );
        }
        return served(hit, "STALE");
      }
    }

    await next();
    if (c.res.status === 200 && !c.res.headers.has("set-cookie")) {
      await store(key, c.res.clone());
    }
    const response = new Response(c.res.body, c.res);
    response.headers.set("x-cache", "MISS");
    c.res = response;
  });
}
