import { describe, expect, it } from "vitest";
import { isAllowedEmail } from "./constants";

describe("isAllowedEmail", () => {
  it("accepts DIU staff and student addresses", () => {
    expect(isAllowedEmail("someone@diu.edu.bd")).toBe(true);
    expect(isAllowedEmail(" Student@S.DIU.edu.bd ")).toBe(true);
  });

  it("refuses other domains and subdomains", () => {
    expect(isAllowedEmail("someone@gmail.com")).toBe(false);
    expect(isAllowedEmail("someone@cse.diu.edu.bd")).toBe(false);
    expect(isAllowedEmail("a@b@diu.edu.bd")).toBe(false);
  });
});
