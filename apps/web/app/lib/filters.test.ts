import type { Course, Department } from "@ourdiu/shared";
import { describe, expect, it } from "vitest";
import { applyFilter, courseOptions } from "./filters";

const departments: Department[] = [
  { id: 1, name: "Computer Science and Engineering", shortName: "CSE" },
  { id: 2, name: "Electrical and Electronic Engineering", shortName: "EEE" },
];
const courses: Course[] = [
  { id: 10, name: "Algorithms", departmentId: 1 },
  { id: 11, name: "Discrete Mathematics", departmentId: 1 },
  { id: 20, name: "Discrete Mathematics", departmentId: 2 },
];

describe("courseOptions", () => {
  it("shows all courses suffixed with the department short name when no department is selected", () => {
    expect(courseOptions(courses, departments, null)).toEqual([
      { value: "10", label: "Algorithms (CSE)" },
      { value: "11", label: "Discrete Mathematics (CSE)" },
      { value: "20", label: "Discrete Mathematics (EEE)" },
    ]);
  });

  it("shows only the selected department's courses, without a suffix", () => {
    expect(courseOptions(courses, departments, "2")).toEqual([
      { value: "20", label: "Discrete Mathematics" },
    ]);
  });
});

describe("applyFilter", () => {
  it("sets a filter and resets the page", () => {
    const next = applyFilter(
      new URLSearchParams("page=3&semesterId=1"),
      "examTypeId",
      "2",
      courses,
    );
    expect(next.toString()).toBe("semesterId=1&examTypeId=2");
  });

  it("clears a filter", () => {
    const next = applyFilter(
      new URLSearchParams("semesterId=1"),
      "semesterId",
      null,
      courses,
    );
    expect(next.toString()).toBe("");
  });

  it("drops a course from another department when a department is selected", () => {
    const next = applyFilter(
      new URLSearchParams("courseId=20"),
      "departmentId",
      "1",
      courses,
    );
    expect(next.toString()).toBe("departmentId=1");
  });

  it("keeps a course that belongs to the selected department", () => {
    const next = applyFilter(
      new URLSearchParams("courseId=11"),
      "departmentId",
      "1",
      courses,
    );
    expect(next.get("courseId")).toBe("11");
  });
});
