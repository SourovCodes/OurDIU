import { describe, expect, it } from "vitest";
import { createSubmissionInputSchema } from "./submission";

const issuesFor = (input: Record<string, unknown>) => {
  const result = createSubmissionInputSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.path[0]);
};

describe("createSubmissionInputSchema", () => {
  it("accepts existing values sent as form strings", () => {
    expect(
      createSubmissionInputSchema.parse({
        departmentId: "1",
        courseId: "2",
        semesterId: "3",
        examTypeId: "4",
      }),
    ).toEqual({ departmentId: 1, courseId: 2, semesterId: 3, examTypeId: 4 });
  });

  it("accepts new department, course and semester names", () => {
    expect(
      issuesFor({
        customDepartmentName: " Mechanical Engineering ",
        customDepartmentShortName: "ME",
        customCourseName: "Thermodynamics",
        customSemesterName: "Summer 25",
        examTypeId: "1",
      }),
    ).toEqual([]);
  });

  it("requires exactly one of id or new name per field", () => {
    expect(issuesFor({ examTypeId: "1" })).toEqual([
      "departmentId",
      "courseId",
      "semesterId",
    ]);
    expect(
      issuesFor({
        departmentId: "1",
        customDepartmentName: "Other",
        courseId: "1",
        semesterId: "1",
        examTypeId: "1",
      }),
    ).toEqual(["departmentId"]);
  });

  it("rejects an existing course under a new department", () => {
    expect(
      issuesFor({
        customDepartmentName: "New Department",
        courseId: "1",
        semesterId: "1",
        examTypeId: "1",
      }),
    ).toEqual(["courseId"]);
  });

  it("only allows a short name for a new department", () => {
    expect(
      issuesFor({
        departmentId: "1",
        customDepartmentShortName: "XX",
        courseId: "1",
        semesterId: "1",
        examTypeId: "1",
      }),
    ).toEqual(["customDepartmentShortName"]);
  });

  it("requires an exam type", () => {
    expect(
      issuesFor({ departmentId: "1", courseId: "1", semesterId: "1" }),
    ).toEqual(["examTypeId"]);
  });
});

describe("new names", () => {
  it("are stored in their standard spelling", () => {
    const parsed = createSubmissionInputSchema.parse({
      customDepartmentName: "Computer Science & Engineering",
      customDepartmentShortName: "CSE",
      customCourseName: "Data  Structures & Algorithms.",
      customSemesterName: "Spring 2025",
      examTypeId: "1",
    });
    expect(parsed.customDepartmentName).toBe(
      "Computer Science and Engineering",
    );
    expect(parsed.customCourseName).toBe("Data Structures and Algorithms");
  });
});

describe("semester names", () => {
  const withSemester = (customSemesterName: string) =>
    createSubmissionInputSchema.safeParse({
      departmentId: "1",
      courseId: "2",
      customSemesterName,
      examTypeId: "1",
    });

  it("are stored as term and two-digit year", () => {
    expect(withSemester("fall 2025").data?.customSemesterName).toBe("Fall 25");
  });

  it("must use a known term and a year from 15 to 30", () => {
    for (const name of ["Summer Term", "Winter 25", "Fall 31"]) {
      expect(withSemester(name).success, name).toBe(false);
    }
  });
});
