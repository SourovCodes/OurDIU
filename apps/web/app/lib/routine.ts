import type {
  RoutineClass,
  RoutineDay,
  RoutineSectionSummary,
} from "@ourdiu/shared";
import {
  ROUTINE_DAYS,
  ROUTINE_DEPARTMENT_SLUGS,
  routineGroupLabel,
  routineMinutes,
} from "@ourdiu/shared/constants";

// The Class Routine on the web (docs/PLAN.md, Phase 3). Client-safe helpers.

export type RoutineDepartmentSlug = (typeof ROUTINE_DEPARTMENT_SLUGS)[number];

/** A section to open: its department, name and maybe one lab group. */
export type RoutinePick = {
  department: RoutineDepartmentSlug;
  section: string;
  group: string | null;
};

export function isRoutineDepartment(
  slug: string | undefined,
): slug is RoutineDepartmentSlug {
  return ROUTINE_DEPARTMENT_SLUGS.some((d) => d === slug);
}

/** /routine/cse/67_B, with ?group=B1 for one lab group. */
export function routineHref({ department, section, group }: RoutinePick) {
  return `/routine/${department}/${encodeURIComponent(section)}${
    group ? `?group=${encodeURIComponent(group)}` : ""
  }`;
}

/** The section's name with the lab group, as students write it: 67_B1. */
export function pickLabel({
  section,
  group,
}: Pick<RoutinePick, "section" | "group">) {
  return group ? routineGroupLabel(section, group) : section;
}

/** The PDF of a section's week (`GET /api/v1/routine/…/pdf`). */
export function routinePdfHref({ department, section, group }: RoutinePick) {
  return `/api/v1/routine/${department}/sections/${encodeURIComponent(section)}/pdf${
    group ? `?group=${encodeURIComponent(group)}` : ""
  }`;
}

/**
 * The section a visitor made theirs ("My section"), so /routine offers it first. A
 * cookie, so the server renders the same page the browser will.
 */
export const ROUTINE_COOKIE = "ourdiu_routine";

/** The saved section a Cookie header (or `document.cookie`) holds, if any. */
export function savedRoutine(
  cookie: string | null | undefined,
): RoutinePick | null {
  const value = cookie?.match(
    new RegExp(`(?:^|;\\s*)${ROUTINE_COOKIE}=([^;]+)`),
  )?.[1];
  if (!value) return null;
  const [department, section, group] = decodeURIComponent(value).split("/");
  if (!isRoutineDepartment(department) || !section) return null;
  return { department, section, group: group || null };
}

export function saveRoutine(pick: RoutinePick | null) {
  document.cookie = pick
    ? `${ROUTINE_COOKIE}=${encodeURIComponent(
        [pick.department, pick.section, pick.group ?? ""].join("/"),
      )}; Path=/; Max-Age=31536000; SameSite=Lax`
    : `${ROUTINE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function samePick(a: RoutinePick | null, b: RoutinePick | null) {
  return (
    !!a &&
    !!b &&
    a.department === b.department &&
    a.section === b.section &&
    a.group === b.group
  );
}

/** A lab group's classes: its own labs and the whole section's classes. */
export function classesFor(classes: RoutineClass[], group: string | null) {
  return classes.filter((c) => !group || !c.labGroup || c.labGroup === group);
}

/** Sat–Thu, and Friday only when there are classes on it. */
export function weekDays(classes: RoutineClass[]): RoutineDay[] {
  return ROUTINE_DAYS.filter(
    (d) => d !== "FRI" || classes.some((c) => c.day === "FRI"),
  );
}

/** The day and time in Dhaka, where DIU's classes are. */
export function dhakaNow(date = new Date()): {
  day: RoutineDay;
  minutes: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    day: part("weekday").toUpperCase() as RoutineDay,
    minutes: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

/** Whether a class is on now, still to come today, or over. */
export function classState(
  c: RoutineClass,
  now: { day: RoutineDay; minutes: number },
): "now" | "later" | "over" | null {
  if (c.day !== now.day) return null;
  if (now.minutes >= routineMinutes(c.end)) return "over";
  if (now.minutes >= routineMinutes(c.start)) return "now";
  return "later";
}

/** One choice in the section search: a section, or one of its lab groups. */
export type SectionChoice = {
  section: string;
  group: string | null;
  label: string;
  classCount: number;
};

/** Every section and lab group, as the search offers them. */
export function sectionChoices(
  sections: RoutineSectionSummary[],
): SectionChoice[] {
  return sections.flatMap((s) => [
    {
      section: s.section,
      group: null,
      label: s.section,
      classCount: s.classCount,
    },
    ...s.labGroups.map((g) => ({
      section: s.section,
      group: g,
      label: routineGroupLabel(s.section, g),
      classCount: s.classCount,
    })),
  ]);
}

const squash = (text: string) => text.toUpperCase().replace(/[\s_-]+/g, "");

/**
 * Choices matching what was typed, ignoring case, spaces and underscores ("67b",
 * "67 B1"): those starting with it first. At most `limit`.
 */
export function matchSections(
  choices: SectionChoice[],
  query: string,
  limit = 8,
): SectionChoice[] {
  const q = squash(query);
  if (!q) return [];
  const starts: SectionChoice[] = [];
  const contains: SectionChoice[] = [];
  for (const c of choices) {
    const label = squash(c.label);
    if (label.startsWith(q)) starts.push(c);
    else if (label.includes(q)) contains.push(c);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** The choice that is exactly what was typed ("67_b1" for 67_B, group B1), if any. */
export function exactSection(choices: SectionChoice[], query: string) {
  const q = squash(query);
  return choices.find((c) => squash(c.label) === q) ?? null;
}
