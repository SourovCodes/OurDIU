// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  cacheControlFor,
  NO_STORE,
  PRIVATE,
  PUBLIC,
  withCacheControl,
} from "./cache-control";

const get = (path: string, headers?: HeadersInit) =>
  new Request(`https://ourdiu.com${path}`, { headers });
const ok = (headers?: HeadersInit) => new Response("{}", { headers });

describe("cacheControlFor", () => {
  it.each([
    "/questions/1097.data?_routes=routes%2Fquestion",
    "/questions/courses/7.data?_routes=routes%2Fquestions-course",
    "/questions/departments/5.data?_routes=routes%2Fquestions-department",
    "/questions/browse.data?departmentId=5&_routes=routes%2Fquestions",
    "/api/v1/taxonomy",
    "/api/v1/questions?courseId=7",
  ])("shares %s", (path) => {
    expect(cacheControlFor(get(path), ok())).toBe(PUBLIC);
  });

  it.each([
    // Pages carry the user (the root) until phase 2.
    "/questions/1097",
    // Without _routes every loader runs, the root's too.
    "/questions/1097.data",
    "/questions/1097.data?_routes=root%2Croutes%2Fquestion",
    // A bare browse opens on the visitor's remembered department.
    "/questions/browse.data?_routes=routes%2Fquestions",
    // Reads a cookie.
    "/questions.data?_routes=routes%2Fquestions-home",
    // A question carries a view token.
    "/api/v1/questions/1097",
    "/api/v1/me",
    "/api/auth/get-session",
  ])("keeps %s private", (path) => {
    expect(cacheControlFor(get(path), ok())).toBe(PRIVATE);
  });

  it("keeps the app's signed-in reads private", () => {
    const request = get("/api/v1/questions", { authorization: "Bearer x" });
    expect(cacheControlFor(request, ok())).toBe(PRIVATE);
  });

  it("keeps responses that set a cookie private", () => {
    const response = ok({ "set-cookie": "a=1" });
    expect(cacheControlFor(get("/api/v1/taxonomy"), response)).toBe(PRIVATE);
  });

  it("never shares writes", () => {
    const post = new Request("https://ourdiu.com/api/v1/questions", {
      method: "POST",
    });
    expect(cacheControlFor(post, ok())).toBe(PRIVATE);
  });

  it.each([301, 302, 404, 500])("never stores a %i", (status) => {
    const response = new Response(null, {
      status,
      headers: { "cache-control": "public, max-age=86400" },
    });
    expect(cacheControlFor(get("/api/v1/taxonomy"), response)).toBe(NO_STORE);
  });

  it("never stores a data request's redirect", () => {
    const response = new Response(null, {
      status: 204,
      headers: { "x-remix-redirect": "/questions/7" },
    });
    expect(
      cacheControlFor(
        get("/questions/5.data?_routes=routes%2Fquestion"),
        response,
      ),
    ).toBe(NO_STORE);
  });

  it("keeps a route's own header", () => {
    const response = ok({ "cache-control": "public, max-age=60" });
    expect(cacheControlFor(get("/robots.txt"), response)).toBe(
      "public, max-age=60",
    );
  });
});

describe("withCacheControl", () => {
  it("sets the header on a redirect, whose headers are immutable", () => {
    const response = withCacheControl(
      get("/questions"),
      Response.redirect("https://ourdiu.com/questions", 301),
    );
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "https://ourdiu.com/questions",
    );
    expect(response.headers.get("cache-control")).toBe(NO_STORE);
  });
});
