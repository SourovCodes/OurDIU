import type { Course, Department, Semester } from "@ourdiu/shared";

// Mirrors the API, which also maps typed names onto existing values, so the form
// shows the existing entry right away instead of a "(new)" one.

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** Matches a typed name against department names and short names. */
export function findDepartmentByName(departments: Department[], name: string) {
  return departments.find(
    (d) => sameName(d.name, name) || sameName(d.shortName, name),
  );
}

/** Matches a typed course name within one department. */
export function findCourseByName(
  courses: Course[],
  departmentId: number,
  name: string,
) {
  return courses.find(
    (c) => c.departmentId === departmentId && sameName(c.name, name),
  );
}

export function findSemesterByName(semesters: Semester[], name: string) {
  return semesters.find((s) => sameName(s.name, name));
}
