import { describe, expect, it } from "vitest";
import { theaterFromCookie } from "./theater";

describe("theaterFromCookie", () => {
  it("reads the cookie among others", () => {
    expect(theaterFromCookie("a=b; qb_theater=1; c=d")).toBe(true);
    expect(theaterFromCookie("qb_theater=1")).toBe(true);
  });

  it("is off without it, or with another value", () => {
    expect(theaterFromCookie(null)).toBe(false);
    expect(theaterFromCookie("qb_theater=")).toBe(false);
    expect(theaterFromCookie("qb_theater=10")).toBe(false);
    expect(theaterFromCookie("xqb_theater=1")).toBe(false);
  });
});
