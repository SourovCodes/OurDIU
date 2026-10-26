// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  cacheHeadersFor,
  EDGE,
  hasQuery,
  NO_STORE,
  PRIVATE,
  PUBLIC,
  withCacheHeaders,
  type SharedRoute,
} from "./cache-control";

// As the routes declare it (`handle.shared`).
const SHARED: Record<string, true | ((url: URL) => boolean)> = {
  "routes/question": true,
  "routes/questions-course": true,
  "routes/questions-department": true,
  "routes/questions": hasQuery,
};
const shared: SharedRoute = (id, url) => {
  const rule = SHARED[id];
  return typeof rule === "function" ? rule(url) : rule === true;
};

const get = (path: string, headers?: HeadersInit) =>
  new Request(`https://ourdiu.com${path}`, { headers });
const ok = (headers?: HeadersInit) => new Response("{}", { headers });
const headersFor = (request: Request, response: Response) =>
  cacheHeadersFor(request, response, shared);

const SHARED_HEADERS = {
  "cache-control": PUBLIC,
  "cloudflare-cdn-cache-control": EDGE,
};
const PRIVATE_HEADERS = { "cache-control": PRIVATE };
const NO_STORE_HEADERS = { "cache-control": NO_STORE };

describe("cacheHeadersFor", () => {
  it.each([
    "/questions/1097.data?_routes=routes%2Fquestion",
    "/questions/courses/7.data?_routes=routes%2Fquestions-course",
    "/questions/departments/5.data?_routes=routes%2Fquestions-department",
    "/questions/browse.data?departmentId=5&_routes=routes%2Fquestions",
    "/api/v1/taxonomy",
    "/api/v1/questions?courseId=7",
  ])("shares %s at the edge only", (path) => {
    expect(headersFor(get(path), ok())).toEqual(SHARED_HEADERS);
  });

  it("never lets browsers serve a stale copy", () => {
    expect(PUBLIC).not.toContain("stale-while-revalidate");
    expect(PUBLIC).toContain("max-age=0");
  });

  it.each([
    // Pages carry the user (the root) until phase 2.
    "/questions/1097",
    // Without _routes every loader runs, the root's too.
    "/questions/1097.data",
    "/questions/1097.data?_routes=root%2Croutes%2Fquestion",
    // A bare browse opens on the visitor's remembered department.
    "/questions/browse.data?_routes=routes%2Fquestions",
    // Not declared shared: reads a cookie.
    "/questions.data?_routes=routes%2Fquestions-home",
    // A question carries a view token.
    "/api/v1/questions/1097",
    "/api/v1/me",
    "/api/auth/get-session",
  ])("keeps %s private", (path) => {
    expect(headersFor(get(path), ok())).toEqual(PRIVATE_HEADERS);
  });

  it("keeps the app's signed-in reads private", () => {
    const request = get("/api/v1/questions", { authorization: "Bearer x" });
    expect(headersFor(request, ok())).toEqual(PRIVATE_HEADERS);
  });

  it("keeps responses that set a cookie private", () => {
    const response = ok({ "set-cookie": "a=1" });
    expect(headersFor(get("/api/v1/taxonomy"), response)).toEqual(
      PRIVATE_HEADERS,
    );
  });

  it("never shares writes", () => {
    const post = new Request("https://ourdiu.com/api/v1/questions", {
      method: "POST",
    });
    expect(headersFor(post, ok())).toEqual(PRIVATE_HEADERS);
  });

  it.each([301, 302, 404, 500])("never stores a %i", (status) => {
    const response = new Response(null, {
      status,
      headers: { "cache-control": "public, max-age=86400" },
    });
    expect(headersFor(get("/api/v1/taxonomy"), response)).toEqual(
      NO_STORE_HEADERS,
    );
  });

  it("keeps a data request's redirect private", () => {
    // React Router 8 answers it with a 202, the target in the body.
    const response = new Response("[]", {
      status: 202,
      headers: { "x-remix-response": "yes" },
    });
    expect(
      headersFor(get("/questions/5.data?_routes=routes%2Fquestion"), response),
    ).toEqual(PRIVATE_HEADERS);
  });

  it("keeps a route's own header", () => {
    const response = ok({ "cache-control": "public, max-age=60" });
    expect(headersFor(get("/robots.txt"), response)).toEqual({
      "cache-control": "public, max-age=60",
    });
  });
});

describe("withCacheHeaders", () => {
  it("sets the header on a redirect, whose headers are immutable", () => {
    const response = withCacheHeaders(
      get("/questions"),
      Response.redirect("https://ourdiu.com/questions", 301),
      shared,
    );
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "https://ourdiu.com/questions",
    );
    expect(response.headers.get("cache-control")).toBe(NO_STORE);
  });

  it("adds the edge's lifetime to shared responses", () => {
    const response = withCacheHeaders(get("/api/v1/taxonomy"), ok(), shared);
    expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(EDGE);
  });
});
