import type { Taxonomy } from "@ourdiu/shared";
import { catalogKey } from "@ourdiu/shared/constants";
import { matchRank, queryWords } from "@ourdiu/shared/search";

/** A course with its department, as the search and the course pages show it. */
export type CourseEntry = {
  id: number;
  name: string;
  departmentId: number;
  departmentShortName: string;
  departmentName: string;
  /** Published papers of the course. */
  publishedCount: number;
  /** Other names search finds it by ("pps", "dsa"), lower-case. */
  aliases: string[];
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
            publishedCount: c.publishedCount,
            aliases: c.aliases ?? [],
          },
        ]
      : [];
  });
}

/**
 * Courses that match the typed text by the site's one search rule (`matchRank`,
 * @ourdiu/shared/search: name, initials like "pps", or every word), best first; within a
 * rank, courses of `preferredDepartmentId` first, then A–Z.
 */
export function searchCourses<T extends CourseEntry>(
  courses: T[],
  query: string,
  preferredDepartmentId?: number | null,
): T[] {
  const other = (c: T) => Number(c.departmentId !== preferredDepartmentId);
  return courses
    .map((course) => ({
      course,
      rank: matchRank(course.name, query, course.aliases),
    }))
    .filter((r): r is { course: T; rank: number } => r.rank !== null)
    .sort(
      ({ course: a, rank: ra }, { course: b, rank: rb }) =>
        ra - rb ||
        other(a) - other(b) ||
        a.name.localeCompare(b.name) ||
        a.departmentShortName.localeCompare(b.departmentShortName),
    )
    .map((r) => r.course);
}

/** A name split into the parts that match the typed words and the rest, for highlighting. */
export function highlightParts(
  name: string,
  query: string,
): { text: string; match: boolean }[] {
  const lower = name.toLowerCase();
  const marked = new Array<boolean>(name.length).fill(false);
  for (const w of queryWords(query)) {
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
export function sameCourseKey(name: string): string {
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
