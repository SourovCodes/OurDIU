import { describe, expect, it } from "vitest";
import { canonicalHostRedirect, safeRedirect } from "./redirect";

describe("safeRedirect", () => {
  it.each(["/", "/contribute", "/papers/1?x=1"])(
    "allows relative path %s",
    (to) => {
      expect(safeRedirect(to)).toBe(to);
    },
  );

  it.each([
    null,
    undefined,
    "",
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "contribute",
  ])("falls back for %s", (to) => {
    expect(safeRedirect(to)).toBe("/");
  });
});

describe("canonicalHostRedirect", () => {
  const SITE = "https://ourdiu.com";

  it.each([
    "https://www.ourdiu.com/routine?x=1",
    "https://ourdiu.example.workers.dev/routine?x=1",
  ])("sends %s to the site's host", (from) => {
    const res = canonicalHostRedirect(new Request(from), SITE)!;
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://ourdiu.com/routine?x=1");
  });

  it("keeps the method for other requests", () => {
    const req = new Request("https://www.ourdiu.com/api/v1/x", {
      method: "POST",
    });
    expect(canonicalHostRedirect(req, SITE)!.status).toBe(308);
  });

  it("leaves the site itself and local dev alone", () => {
    expect(
      canonicalHostRedirect(new Request(`${SITE}/questions`), SITE),
    ).toBeNull();
    expect(
      canonicalHostRedirect(
        new Request("http://127.0.0.1:5173/"),
        "http://localhost:5173",
      ),
    ).toBeNull();
  });
});
