import type {
  RoutineSection,
  RoutineSectionList,
  RoutineTeacherWeek,
} from "@ourdiu/shared";
import { ROUTINE_DEPARTMENT_SLUGS } from "@ourdiu/shared/constants";
import { data } from "react-router";
import { apiFetch, apiGetJson, readJson } from "~/lib/api.server";
import {
  classesFor,
  isTeacherPick,
  pickLabel,
  routineHref,
  teacherClass,
  teacherHref,
  teacherName,
  type RoutineDepartmentSlug,
  type SavedRoutine,
  type ShownClass,
} from "~/lib/routine";

/** Each department's live routine's sections, or null while it's coming soon. */
export async function routineLists(request: Request) {
  const lists = await Promise.all(
    ROUTINE_DEPARTMENT_SLUGS.map(async (department) => {
      const res = await apiFetch(
        request,
        `/api/v1/routine/${department}/sections`,
      );
      if (res.status === 404) return { department, list: null };
      if (!res.ok) throw data("API request failed", { status: 502 });
      return { department, list: await readJson<RoutineSectionList>(res) };
    }),
  );
  return {
    lists,
    live: lists.flatMap((l) => (l.list ? [l.department] : [])),
    /** The departments with their live version, for the department switch. */
    departments: lists.map((l) => ({
      department: l.department,
      version: l.list?.version.version ?? null,
    })),
  };
}

/** The routine a visitor made theirs, with its week, for the Today page. */
export type MyRoutine = {
  department: RoutineDepartmentSlug;
  kind: "section" | "teacher";
  /** "67_B1", or the teacher's name. */
  name: string;
  href: string;
  classes: ShownClass[];
  /** The section's name; "" for a teacher's week. */
  section: string;
  /** The saved section, to highlight it among the department's sections. */
  pick: SavedRoutine;
};

/** The saved routine's week; null when nothing's saved or it's gone from the routine. */
export async function myRoutine(
  request: Request,
  saved: SavedRoutine | null,
  live: RoutineDepartmentSlug[],
): Promise<MyRoutine | null> {
  if (!saved || !live.includes(saved.department)) return null;
  if (isTeacherPick(saved)) {
    const week = await apiGetJson<RoutineTeacherWeek>(
      request,
      `/api/v1/routine/${saved.department}/teachers/${encodeURIComponent(saved.teacher)}`,
    ).catch(() => null);
    return week
      ? {
          department: saved.department,
          kind: "teacher",
          name: teacherName(week.teacher),
          href: teacherHref(saved),
          classes: week.classes.map(teacherClass),
          section: "",
          pick: saved,
        }
      : null;
  }
  const routine = await apiGetJson<RoutineSection>(
    request,
    `/api/v1/routine/${saved.department}/sections/${encodeURIComponent(saved.section)}`,
  ).catch(() => null);
  return routine
    ? {
        department: saved.department,
        kind: "section",
        name: pickLabel(saved),
        href: routineHref(saved),
        classes: classesFor(routine.classes, saved.group),
        section: routine.section,
        pick: saved,
      }
    : null;
}
