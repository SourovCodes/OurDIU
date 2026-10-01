import { describe, expect, it } from "vitest";
import {
  catalogKey,
  isDiuEmail,
  normalizeCatalogName,
  parseSemesterName,
} from "./constants";

describe("normalizeCatalogName", () => {
  it.each([
    ["Computer Science & Engineering", "Computer Science and Engineering"],
    ["Computer Science&Engineering", "Computer Science and Engineering"],
    ["  Data   Structures  ", "Data Structures"],
    ["Business Administration.", "Business Administration"],
    ["Men’s Health", "Men's Health"],
    ["C++ Programming", "C++ Programming"],
    ["Physics-I", "Physics I"],
    ["Agricultural Chemistry -I", "Agricultural Chemistry I"],
    ["Fabric Manufacturing - ii", "Fabric Manufacturing II"],
    ["English-1", "English 1"],
    ["Statistics for Decision-Making", "Statistics for Decision-Making"],
    [
      "Microprocessor and Micro-controller",
      "Microprocessor and Micro-controller",
    ],
  ])("%s → %s", (input, output) => {
    expect(normalizeCatalogName(input)).toBe(output);
  });
});

describe("catalogKey", () => {
  it("ignores case and the & spelling", () => {
    expect(catalogKey("Electrical & Electronic engineering")).toBe(
      catalogKey("electrical and electronic Engineering"),
    );
  });
});

describe("parseSemesterName", () => {
  it.each([
    ["Fall 25", "Fall 25"],
    ["fall 2025", "Fall 25"],
    ["SPRING-26", "Spring 26"],
    ["Summer'20", "Summer 20"],
    [" short  15 ", "Short 15"],
    ["Fall 30", "Fall 30"],
  ])("%s → %s", (input, output) => {
    expect(parseSemesterName(input)).toBe(output);
  });

  it.each([
    "Fall 14",
    "Spring 31",
    "Winter 25",
    "1st Semester",
    "Fall",
    "25",
    "Fall 2125",
  ])("rejects %s", (input) => {
    expect(parseSemesterName(input)).toBeNull();
  });
});

describe("isDiuEmail", () => {
  it.each(["a@diu.edu.bd", "B@S.DIU.EDU.BD", " c@s.diu.edu.bd "])(
    "allows %s",
    (email) => {
      expect(isDiuEmail(email)).toBe(true);
    },
  );

  it.each([
    "a@gmail.com",
    "a@evil.diu.edu.bd",
    "a@diu.edu.bd.evil.com",
    "diu.edu.bd",
    "@diu.edu.bd",
    "a@b@diu.edu.bd",
    "",
  ])("refuses %s", (email) => {
    expect(isDiuEmail(email)).toBe(false);
  });
});
