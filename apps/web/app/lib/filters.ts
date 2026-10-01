import type { Course, Department } from "@ourdiu/shared";

export type SelectOption = { value: string; label: string };

export const FILTER_KEYS = [
  "departmentId",
  "courseId",
  "semesterId",
  "examTypeId",
] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

/** URL parameters of the questions list besides the filters. */
export const LIST_KEYS = ["sort"] as const;

/**
 * Course options for the course filter. With a department selected, only that
 * department's courses are shown; otherwise every course, suffixed with its
 * department's short name so same-named courses can be told apart.
 */
export function courseOptions(
  courses: Course[],
  departments: Department[],
  departmentId: string | null,
): SelectOption[] {
  if (departmentId) {
    return courses
      .filter((course) => String(course.departmentId) === departmentId)
      .map((course) => ({ value: String(course.id), label: course.name }));
  }
  const shortNames = new Map(departments.map((d) => [d.id, d.shortName]));
  return courses.map((course) => ({
    value: String(course.id),
    label: `${course.name} (${shortNames.get(course.departmentId) ?? "?"})`,
  }));
}

/**
 * Returns new search params with one filter changed. Resets pagination, and drops
 * the selected course when it doesn't belong to a newly selected department.
 */
export function applyFilter(
  params: URLSearchParams,
  key: FilterKey,
  value: string | null,
  courses: Course[],
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value) next.set(key, value);
  else next.delete(key);
  next.delete("page");

  if (key === "departmentId" && value) {
    const course = courses.find((c) => String(c.id) === next.get("courseId"));
    if (course && String(course.departmentId) !== value)
      next.delete("courseId");
  }
  return next;
}
