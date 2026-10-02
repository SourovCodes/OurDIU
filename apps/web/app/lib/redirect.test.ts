import { describe, expect, it } from "vitest";
import {
  afterLogoutPath,
  canonicalHostRedirect,
  legacyPath,
  loginHref,
  safeRedirect,
} from "./redirect";
import { product, rememberedSpace, spaceAt } from "./products";

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
  it("puts /diuqbank in the question bank, though it sits at the root", () => {
    expect(spaceAt({ pathname: "/diuqbank", search: "" })?.id).toBe(
      "questions",
    );
  });
});

describe("spaceAt with a remembered space", () => {
  const questions = product("questions");
  it("keeps platform pages in the last space, but not the hub or admin", () => {
    for (const pathname of ["/account", "/privacy", "/missing-page"]) {
      expect(spaceAt({ pathname, search: "" }, questions)?.id).toBe(
        "questions",
      );
    }
    expect(spaceAt({ pathname: "/", search: "" }, questions)).toBeNull();
    expect(spaceAt({ pathname: "/admin", search: "" }, questions)).toBeNull();
    // A product's own pages are always its own.
    expect(spaceAt({ pathname: "/routine", search: "" }, questions)?.id).toBe(
      "routine",
    );
  });
  it("reads the space from a Cookie header", () => {
    expect(rememberedSpace("a=1; ourdiu_space=market")?.id).toBe("market");
    expect(rememberedSpace("ourdiu_space=nope")).toBeNull();
    expect(rememberedSpace(null)).toBeNull();
  });
});

describe("afterLogoutPath", () => {
  it("stays on pages that work signed out", () => {
    expect(
      afterLogoutPath({ pathname: "/questions/12", search: "?submission=3" }),
    ).toBe("/questions/12?submission=3");
  });
  it("leaves signed-in pages for the space's home", () => {
    expect(
      afterLogoutPath(
        { pathname: "/account/profile", search: "" },
        "/questions",
      ),
    ).toBe("/questions");
    expect(
      afterLogoutPath({ pathname: "/questions/my-submissions/4", search: "" }),
    ).toBe("/");
  });
});
