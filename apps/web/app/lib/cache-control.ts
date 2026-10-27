import { QUESTION_BANK_CACHE_TAG } from "@ourdiu/shared/constants";

// Cache headers for every response the Worker sends (docs/PLAN.md, decision 62).
// Workers Cache keys entries by path and query only, not by host, cookies or user
// agent, and it stores responses that carry no Cache-Control. So every response
// gets one: shared only when everything in it is the same for every visitor,
// errors and redirects never stored, everything else private.

/** For browsers: check every time. Edges keep shared responses by `EDGE` instead. */
export const PUBLIC = "public, max-age=0, must-revalidate";
/**
 * For Cloudflare alone (`Cloudflare-CDN-Cache-Control`, not passed on to
 * browsers, so they never show a stale copy): fresh for a minute, then served
 * while it refreshes.
 */
export const EDGE = "max-age=60, stale-while-revalidate=86400";
/** Never stored by a shared cache. Not `no-store`, which turns off the back/forward cache. */
export const PRIVATE = "private, no-cache";
export const NO_STORE = "no-store";

/**
 * Whether route `routeId`'s data for `url` may be shared: declared beside each
 * loader, by `handle.shared` (`RouteHandle` in root.tsx).
 */
export type SharedRoute = (routeId: string, url: URL) => boolean;

/** API reads that are the same for every caller. Not a question's page (its view token). */
const PUBLIC_API = new Set([
  "/api/v1/taxonomy",
  "/api/v1/departments",
  "/api/v1/courses",
  "/api/v1/courses/trending",
  "/api/v1/semesters",
  "/api/v1/exam-types",
  "/api/v1/questions",
  "/api/v1/questions/search",
]);

/** Query parameters React Router adds to data requests. */
const ROUTER_PARAMS = new Set(["_routes", "index"]);

/** Whether `url` has a query of its own, besides React Router's. */
export function hasQuery(url: URL) {
  return [...url.searchParams.keys()].some((key) => !ROUTER_PARAMS.has(key));
}

/**
 * A page's data (`.data`) may be shared when the request names the routes to load
 * (`_routes`, sent when the root isn't revalidated) and each of them is shared.
 * Without `_routes` every loader runs, the root's too. Pages themselves (HTML)
 * stay private until the root stops rendering the user (phase 2).
 */
function sharedData(url: URL, shared: SharedRoute) {
  if (!url.pathname.endsWith(".data")) return false;
  const routes = url.searchParams.get("_routes")?.split(",") ?? [];
  if (routes.length === 0) return false;
  const page = new URL(url);
  page.pathname = url.pathname.slice(0, -".data".length);
  return routes.every((id) => shared(id, page));
}

/** The cache headers a response should go out with. */
export function cacheHeadersFor(
  request: Request,
  response: Response,
  shared: SharedRoute,
): Record<string, string> {
  const { status } = response;
  if (status >= 300 && status !== 304) return { "cache-control": NO_STORE };
  const set = response.headers.get("cache-control");
  if (set) return { "cache-control": set };
  const url = new URL(request.url);
  const shareable =
    (request.method === "GET" || request.method === "HEAD") &&
    // Not a 202: React Router's answer when a data request redirects.
    status === 200 &&
    !request.headers.has("authorization") &&
    !response.headers.has("set-cookie") &&
    (PUBLIC_API.has(url.pathname) || sharedData(url, shared));
  return shareable
    ? {
        "cache-control": PUBLIC,
        "cloudflare-cdn-cache-control": EDGE,
        // What the API clears when the question bank changes (its lib/cache.ts).
        "cache-tag": QUESTION_BANK_CACHE_TAG,
      }
    : { "cache-control": PRIVATE };
}

/** The response with the cache headers it should go out with. */
export function withCacheHeaders(
  request: Request,
  response: Response,
  shared: SharedRoute,
) {
  const wanted = Object.entries(cacheHeadersFor(request, response, shared));
  if (wanted.every(([name, value]) => response.headers.get(name) === value)) {
    return response;
  }
  // Responses from fetch() and Response.redirect() have immutable headers.
  const headers = new Headers(response.headers);
  for (const [name, value] of wanted) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
