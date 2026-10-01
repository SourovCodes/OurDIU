import { describe, expect, it } from "vitest";
import {
  canonicalHostRedirect,
  legacyPath,
  loginHref,
  safeRedirect,
} from "./redirect";
import { spaceAt } from "./products";

describe("safeRedirect", () => {
  it.each(["/", "/questions/contribute", "/papers/1?x=1"])(
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
    "https://www.ourdiu.com/questions/5?submission=7",
    "https://ourdiu.example.workers.dev/questions/5?submission=7",
  ])("sends %s to the site's host", (from) => {
    const res = canonicalHostRedirect(new Request(from), SITE)!;
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(
      "https://ourdiu.com/questions/5?submission=7",
    );
  });

  it("keeps the method for other requests", () => {
    const req = new Request("https://www.ourdiu.com/api/v1/x", {
      method: "POST",
    });
    expect(canonicalHostRedirect(req, SITE)!.status).toBe(308);
  });

  it("sends the old question bank's pages to their new paths", () => {
    const res = canonicalHostRedirect(
      new Request("https://diuqbank.com/questions?departmentId=3"),
      SITE,
    )!;
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(
      "https://ourdiu.com/questions/browse?departmentId=3",
    );
  });

  it("keeps serving the old question bank's API for the installed app", () => {
    for (const host of ["diuqbank.com", "www.diuqbank.com"]) {
      const req = new Request(`https://${host}/api/v1/questions`, {
        method: "POST",
      });
      expect(canonicalHostRedirect(req, SITE)).toBeNull();
    }
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

describe("legacyPath", () => {
  it.each([
    ["/", "/questions"],
    ["/questions", "/questions/browse"],
    ["/questions/42", "/questions/42"],
    ["/contributors", "/questions/contributors"],
    ["/contributors/sourov", "/questions/contributors/sourov"],
    ["/contribute", "/questions/contribute"],
    ["/account/submissions", "/questions/my-submissions"],
    ["/account/submissions/abc", "/questions/my-submissions/abc"],
    ["/account", "/account"],
    ["/privacy", "/privacy"],
  ])("maps %s to %s", (from, to) => {
    expect(legacyPath(from)).toBe(to);
  });
});

describe("loginHref", () => {
  it("comes back to the page the visitor is on", () => {
    expect(
      loginHref({ pathname: "/questions/12", search: "?submission=3" }),
    ).toBe("/login?redirectTo=%2Fquestions%2F12%3Fsubmission%3D3");
  });
  it("has no return path from the hub, and keeps its own on the login page", () => {
    expect(loginHref({ pathname: "/", search: "" })).toBe("/login");
    expect(
      loginHref({ pathname: "/login", search: "?redirectTo=%2Fquestions" }),
    ).toBe("/login?redirectTo=%2Fquestions");
  });
});

describe("spaceAt", () => {
  it("puts the login page in the space it returns to", () => {
    expect(
      spaceAt({ pathname: "/login", search: "?redirectTo=%2Fquestions%2F12" })
        ?.id,
    ).toBe("questions");
    expect(spaceAt({ pathname: "/login", search: "" })).toBeNull();
    expect(
      spaceAt({
        pathname: "/login",
        search: "?redirectTo=https%3A%2F%2Fevil.com",
      }),
    ).toBeNull();
    expect(spaceAt({ pathname: "/routine", search: "" })?.id).toBe("routine");
  });
});
