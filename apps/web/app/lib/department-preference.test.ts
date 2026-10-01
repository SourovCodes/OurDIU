import { describe, expect, it } from "vitest";
import {
  rememberDepartmentCookie,
  rememberedDepartment,
} from "./department-preference";

describe("rememberedDepartment", () => {
  it("reads the department id among other cookies", () => {
    expect(rememberedDepartment("a=1; qb_department=23; b=2")).toBe("23");
    expect(rememberedDepartment("qb_department=7")).toBe("7");
  });

  it("ignores missing or malformed values", () => {
    expect(rememberedDepartment(null)).toBeNull();
    expect(rememberedDepartment("qb_department=abc")).toBeNull();
    expect(rememberedDepartment("xqb_department=5")).toBeNull();
  });

  it("round-trips through the Set-Cookie value", () => {
    const cookie = rememberDepartmentCookie("12").split(";")[0]!;
    expect(rememberedDepartment(cookie)).toBe("12");
  });
});
