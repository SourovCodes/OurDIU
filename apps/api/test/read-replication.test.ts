import { describe, expect, it } from "vitest";
import { d1For } from "../src/db/client";

/** A D1 binding that records the constraint each session was opened with. */
function fakeD1() {
  const opened: (string | undefined)[] = [];
  const d1 = {
    withSession(constraint?: string) {
      opened.push(constraint);
      return {} as D1DatabaseSession;
    },
  } as unknown as D1Database;
  return { d1, opened };
}

function routeOf(path: string, init: RequestInit = {}) {
  const { d1, opened } = fakeD1();
  d1For(d1, new Request(`https://ourdiu.com${path}`, init));
  return opened[0];
}

describe("read replication", () => {
  it("sends anonymous reads to the nearest copy", () => {
    expect(routeOf("/api/v1/questions")).toBe("first-unconstrained");
    expect(routeOf("/api/v1/questions/1", { method: "HEAD" })).toBe(
      "first-unconstrained",
    );
    expect(
      routeOf("/api/v1/questions", { headers: { cookie: "ourdiu_space=qb" } }),
    ).toBe("first-unconstrained");
  });

  it("sends writes, sign-in and signed-in visitors to the primary", () => {
    expect(routeOf("/api/v1/questions/1/views", { method: "POST" })).toBe(
      "first-primary",
    );
    expect(routeOf("/api/auth/callback/google?code=x")).toBe("first-primary");
    expect(
      routeOf("/api/v1/questions", {
        headers: { cookie: "a=1; better-auth.session_token=abc" },
      }),
    ).toBe("first-primary");
    expect(
      routeOf("/api/v1/questions", {
        headers: { cookie: "__Secure-better-auth.session_token=abc" },
      }),
    ).toBe("first-primary");
    expect(
      routeOf("/api/v1/me/saved", {
        headers: { authorization: "Bearer abc" },
      }),
    ).toBe("first-primary");
  });
});
