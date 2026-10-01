import { describe, expect, it } from "vitest";
import { canContribute, isDiuEmail } from "./constants";

describe("isDiuEmail", () => {
  it("accepts DIU staff and student addresses", () => {
    expect(isDiuEmail("someone@diu.edu.bd")).toBe(true);
    expect(isDiuEmail(" Student@S.DIU.edu.bd ")).toBe(true);
  });

  it("refuses other domains and subdomains", () => {
    expect(isDiuEmail("someone@gmail.com")).toBe(false);
    expect(isDiuEmail("someone@cse.diu.edu.bd")).toBe(false);
    expect(isDiuEmail("a@b@diu.edu.bd")).toBe(false);
  });
});

describe("canContribute", () => {
  it("lets DIU addresses and admins contribute", () => {
    expect(canContribute({ email: "a@diu.edu.bd", role: "user" })).toBe(true);
    expect(canContribute({ email: "boss@gmail.com", role: "admin" })).toBe(
      true,
    );
  });

  it("refuses other addresses", () => {
    expect(canContribute({ email: "a@gmail.com", role: "user" })).toBe(false);
    expect(canContribute({ email: "a@gmail.com" })).toBe(false);
  });
});
