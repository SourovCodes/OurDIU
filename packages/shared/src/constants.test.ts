import { describe, expect, it } from "vitest";
import {
  canContribute,
  isDiuEmail,
  splitStudentId,
  STUDENT_ID_PATTERN,
} from "./constants";

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

describe("STUDENT_ID_PATTERN", () => {
  it("accepts both formats", () => {
    for (const id of [
      "241-15-047",
      "251-33-1054",
      "182-15-11651",
      "0242220005101255",
    ]) {
      expect(STUDENT_ID_PATTERN.test(id)).toBe(true);
    }
  });

  it("refuses anything else", () => {
    for (const id of [
      "24115047",
      "241-15-04",
      "2.4231E+14",
      "024222000510125",
    ]) {
      expect(STUDENT_ID_PATTERN.test(id)).toBe(false);
    }
  });
});

describe("splitStudentId", () => {
  it("takes the ID out of the name", () => {
    expect(splitStudentId("Md Samir 262-35-490")).toEqual({
      name: "Md Samir",
      studentId: "262-35-490",
    });
    expect(splitStudentId("Marjan Hosen Oni 0242220005101255")).toEqual({
      name: "Marjan Hosen Oni",
      studentId: "0242220005101255",
    });
  });

  it("drops the brackets and separators around it", () => {
    expect(splitStudentId("Tanvir Hasan Akash (262-15-167)").name).toBe(
      "Tanvir Hasan Akash",
    );
    expect(splitStudentId("Fariha Islam Mim....251-33-054").name).toBe(
      "Fariha Islam Mim",
    );
    expect(splitStudentId("Md. Shahrin Akhter 261-58-052 (Ramiz)").name).toBe(
      "Md. Shahrin Akhter (Ramiz)",
    );
    expect(splitStudentId("261-15-462 (Oikko)").name).toBe("Oikko");
  });

  it("leaves names without a whole ID alone", () => {
    for (const name of [
      "Riti 787",
      "Rakib 2.4231E+14",
      "Ab 1241-15-047",
      "Muhtasim Mahir (262)",
    ]) {
      expect(splitStudentId(name)).toEqual({ name, studentId: null });
    }
  });

  it("keeps a name that is only an ID", () => {
    expect(splitStudentId("241-15-047")).toEqual({
      name: "241-15-047",
      studentId: null,
    });
  });
});
