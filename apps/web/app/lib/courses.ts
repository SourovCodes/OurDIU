import type { Taxonomy } from "@ourdiu/shared";
import { catalogKey } from "@ourdiu/shared/constants";

/** A course with its department, as the search and the course pages show it. */
export type CourseEntry = {
  id: number;
  name: string;
  departmentId: number;
  departmentShortName: string;
  departmentName: string;
};

/** Every course of the taxonomy with its department's names. */
export function courseEntries({
  departments,
  courses,
}: Pick<Taxonomy, "departments" | "courses">): CourseEntry[] {
  const byId = new Map(departments.map((d) => [d.id, d]));
  return courses.flatMap((c) => {
    const department = byId.get(c.departmentId);
    return department
      ? [
          {
            id: c.id,
            name: c.name,
            departmentId: department.id,
            departmentShortName: department.shortName,
            departmentName: department.name,
          },
        ]
      : [];
  });
}

function words(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Courses whose name contains every word typed, in any order, ignoring case
 * ("math 1" finds "Mathematics I" only if both words match). Names that start with
 * the query come first, then A–Z; same as the app's `searchCourses`. Courses of
 * `preferredDepartmentId` come before others with the same rank.
 */
export function searchCourses<T extends CourseEntry>(
  courses: T[],
  query: string,
  preferredDepartmentId?: number | null,
): T[] {
  const typed = words(query);
  if (typed.length === 0) return [];
  const q = query.trim().toLowerCase();
  const rank = (c: T) =>
    (c.name.toLowerCase().startsWith(q) ? 0 : 2) +
    (c.departmentId === preferredDepartmentId ? 0 : 1);
  return courses
    .filter((c) => {
      const name = c.name.toLowerCase();
      return typed.every((w) => name.includes(w));
    })
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        a.name.localeCompare(b.name) ||
        a.departmentShortName.localeCompare(b.departmentShortName),
    );
}

/** A name split into the parts that match the typed words and the rest, for highlighting. */
export function highlightParts(
  name: string,
  query: string,
): { text: string; match: boolean }[] {
  const lower = name.toLowerCase();
  const marked = new Array<boolean>(name.length).fill(false);
  for (const w of words(query)) {
    for (let i = lower.indexOf(w); i !== -1; i = lower.indexOf(w, i + 1)) {
      marked.fill(true, i, i + w.length);
    }
  }
  const parts: { text: string; match: boolean }[] = [];
  for (let i = 0; i < name.length; i++) {
    const last = parts.at(-1);
    if (last && last.match === marked[i]) last.text += name[i];
    else parts.push({ text: name[i]!, match: marked[i]! });
  }
  return parts;
}

/** "Data Structures" and "Data Structure" are the same course filed under two names. */
function sameCourseKey(name: string): string {
  return catalogKey(name)
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/s\b/g, "");
}

/**
 * Other courses that are probably this one: the same name up to a plural, in any
 * department. Papers are filed under the name on the question sheet, so a course can
 * have its papers split across these.
 */
export function sameCourses<T extends CourseEntry>(
  courses: T[],
  course: CourseEntry,
): T[] {
  const key = sameCourseKey(course.name);
  return courses
    .filter((c) => c.id !== course.id && sameCourseKey(c.name) === key)
    .sort(
      (a, b) =>
        Number(b.departmentId === course.departmentId) -
          Number(a.departmentId === course.departmentId) ||
        a.departmentShortName.localeCompare(b.departmentShortName),
    );
}

/** Courses under their first letter, A–Z, for a department's course list. */
export function byInitial<T extends { name: string }>(
  courses: T[],
): { letter: string; courses: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const course of [...courses].sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const first = course.name[0]?.toUpperCase() ?? "#";
    const letter = /[A-Z]/.test(first) ? first : "#";
    groups.set(letter, [...(groups.get(letter) ?? []), course]);
  }
  return [...groups].map(([letter, list]) => ({ letter, courses: list }));
}
