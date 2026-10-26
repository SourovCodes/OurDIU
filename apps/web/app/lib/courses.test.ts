import { expect, it } from "vitest";
import {
  byInitial,
  highlightParts,
  sameCourses,
  searchCourses,
  type CourseEntry,
} from "./courses";

const course = (
  id: number,
  name: string,
  departmentId = 1,
  departmentShortName = "CSE",
  aliases: string[] = [],
): CourseEntry => ({
  id,
  name,
  departmentId,
  departmentShortName,
  departmentName: departmentShortName,
  publishedCount: 1,
  aliases,
});

const courses = [
  course(1, "Data Structure"),
  course(2, "Data Structures"),
  course(3, "Data Structure", 2, "SWE"),
  course(4, "Big Data Analytics"),
  course(5, "Mathematics I"),
  course(6, "Introduction to Data Science"),
];

it("needs every word, in any order", () => {
  expect(searchCourses(courses, "str data").map((c) => c.id)).toEqual([
    1, 3, 2,
  ]);
  expect(searchCourses(courses, "math 1")).toEqual([]);
  expect(searchCourses(courses, "  ")).toEqual([]);
});

it("ranks names that start with the query first, then the preferred department", () => {
  expect(searchCourses(courses, "data").map((c) => c.id)).toEqual([
    1, 3, 2, 4, 6,
  ]);
  expect(searchCourses(courses, "data struct", 2).map((c) => c.id)).toEqual([
    3, 1, 2,
  ]);
});

it("finds courses by the start of their initials", () => {
  const all = [
    ...courses,
    course(7, "Programming and Problem Solving"),
    course(8, "Data Structures Lab"),
    course(9, "Dispersion Studies", 2, "SWE"),
  ];
  expect(searchCourses(all, "PPS").map((c) => c.id)).toEqual([7]);
  expect(searchCourses(all, "ids").map((c) => c.id)).toEqual([6]);
  // Exact initials before their start, the preferred department first in each.
  expect(searchCourses(all, "ds", 2).map((c) => c.id)).toEqual([3, 9, 1, 2, 8]);
  expect(searchCourses(all, "pp").map((c) => c.id)).toEqual([7]);
  // More than one word is never read as initials.
  expect(searchCourses(all, "pp s")).toEqual([]);
});

it("finds courses by their short names", () => {
  const all = [
    ...courses,
    course(7, "Mathematics II", 1, "CSE", ["calculus"]),
    course(8, "Calculus for Engineers", 2, "EEE"),
  ];
  // A name that starts with the query first, then a short name it starts.
  expect(searchCourses(all, "calc").map((c) => c.id)).toEqual([8, 7]);
  expect(searchCourses(all, "calculus").map((c) => c.id)).toEqual([8, 7]);
});

it("highlights every typed word", () => {
  expect(highlightParts("Data Structure", "str da")).toEqual([
    { text: "Da", match: true },
    { text: "ta ", match: false },
    { text: "Str", match: true },
    { text: "ucture", match: false },
  ]);
  expect(highlightParts("Physics", "")).toEqual([
    { text: "Physics", match: false },
  ]);
});

it("finds the same course under other names", () => {
  expect(sameCourses(courses, courses[0]!).map((c) => c.id)).toEqual([2, 3]);
  expect(sameCourses(courses, courses[4]!)).toEqual([]);
});

it("groups courses by initial", () => {
  expect(
    byInitial([course(1, "Physics"), course(2, "algebra"), course(3, "1st")]),
  ).toEqual([
    { letter: "#", courses: [course(3, "1st")] },
    { letter: "A", courses: [course(2, "algebra")] },
    { letter: "P", courses: [course(1, "Physics")] },
  ]);
});
