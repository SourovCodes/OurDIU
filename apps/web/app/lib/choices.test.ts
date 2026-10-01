import { describe, expect, it } from "vitest";
import {
  findCourseByName,
  findDepartmentByName,
  findSemesterByName,
} from "./choices";

const departments = [
  { id: 1, name: "Computer Science and Engineering", shortName: "CSE" },
  { id: 2, name: "Electrical and Electronic Engineering", shortName: "EEE" },
];
const courses = [
  { id: 10, name: "Discrete Mathematics", departmentId: 1 },
  { id: 20, name: "Discrete Mathematics", departmentId: 2 },
];
const semesters = [{ id: 3, name: "Fall 24" }];

describe("findDepartmentByName", () => {
  it.each(["cse", " CSE ", "computer science and engineering"])(
    "matches %j case-insensitively by name or short name",
    (name) => {
      expect(findDepartmentByName(departments, name)?.id).toBe(1);
    },
  );

  it("returns undefined for a new department", () => {
    expect(findDepartmentByName(departments, "Mechanical")).toBeUndefined();
  });
});

describe("findCourseByName", () => {
  it("matches only within the given department", () => {
    expect(findCourseByName(courses, 2, "discrete mathematics")?.id).toBe(20);
    expect(
      findCourseByName(courses, 3, "Discrete Mathematics"),
    ).toBeUndefined();
  });
});

describe("findSemesterByName", () => {
  it("matches case-insensitively", () => {
    expect(findSemesterByName(semesters, "FALL 24")?.id).toBe(3);
  });
});
