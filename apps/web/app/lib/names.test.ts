import { describe, expect, it } from "vitest";
import { initials } from "./names";

describe("initials", () => {
  it.each([
    ["Ayesha Rahman", "AR"],
    ["  nusrat   jahan khan ", "NJ"],
    ["Tanvir", "T"],
    ["Abdullah (CSE-232)", "A"],
    ["Md Siam Hossain 251-35-327", "MS"],
    ["(guest)", "G"],
    ["", "?"],
  ])("%j → %s", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
