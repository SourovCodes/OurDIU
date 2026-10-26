// Cache-Control for every response the Worker sends (docs/PLAN.md, decision 62).
// Workers Cache keys entries by path and query only, not by host, cookies or user
// agent, and it stores responses that carry no Cache-Control. So every response
// gets one: public only when everything in it is the same for every visitor (the
// lists below), errors and redirects never stored, everything else private.

/** Fresh at the edge for a minute, then served while it refreshes; browsers always check. */
export const PUBLIC =
  "public, max-age=0, s-maxage=60, stale-while-revalidate=86400";
/** Never stored by a shared cache. Not `no-store`, which turns off the back/forward cache. */
export const PRIVATE = "private, no-cache";
export const NO_STORE = "no-store";

/**
 * Routes whose loaders return the same data for every visitor and set no cookie,
 * with the requests they apply to. The root is never one: it carries the user.
 */
const PUBLIC_ROUTES: Record<string, (url: URL) => boolean> = {
  "routes/question": () => true,
  "routes/questions-course": () => true,
  "routes/questions-department": () => true,
  // A bare /questions/browse opens on the visitor's remembered department.
  "routes/questions": (url) => hasQuery(url),
};

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

function hasQuery(url: URL) {
  return [...url.searchParams.keys()].some((key) => !ROUTER_PARAMS.has(key));
}

/**
 * A page's data (`.data`) is public when the request names the routes to load
 * (`_routes`, sent when the root isn't revalidated) and each of them is public.
 * Without `_routes` every loader runs, the root's too. Pages themselves (HTML)
 * stay private until the root stops rendering the user (phase 2).
 */
function publicData(url: URL) {
  if (!url.pathname.endsWith(".data")) return false;
  const routes = url.searchParams.get("_routes")?.split(",") ?? [];
  if (routes.length === 0) return false;
  const page = new URL(url);
  page.pathname = url.pathname.slice(0, -".data".length);
  return routes.every((id) => PUBLIC_ROUTES[id]?.(page) ?? false);
}

/** The Cache-Control a response should go out with. */
export function cacheControlFor(request: Request, response: Response) {
  const { status } = response;
  if (status >= 300 && status !== 304) return NO_STORE;
  // React Router answers a data request's redirect with a 204.
  if (response.headers.has("x-remix-redirect")) return NO_STORE;
  const set = response.headers.get("cache-control");
  if (set) return set;
  const url = new URL(request.url);
  const shared =
    (request.method === "GET" || request.method === "HEAD") &&
    status === 200 &&
    !request.headers.has("authorization") &&
    !response.headers.has("set-cookie") &&
    (PUBLIC_API.has(url.pathname) || publicData(url));
  return shared ? PUBLIC : PRIVATE;
}

/** The response with the Cache-Control it should go out with. */
export function withCacheControl(request: Request, response: Response) {
  const value = cacheControlFor(request, response);
  if (response.headers.get("cache-control") === value) return response;
  // Responses from fetch() and Response.redirect() have immutable headers.
  const headers = new Headers(response.headers);
  headers.set("cache-control", value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
