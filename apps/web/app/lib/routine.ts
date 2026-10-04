import type {
  RoutineClass,
  RoutineDay,
  RoutineDepartment,
  RoutineSectionSummary,
  RoutineTeacherClass,
  RoutineTeacherSummary,
} from "@ourdiu/shared";
import {
  ROUTINE_DAY_NAMES,
  ROUTINE_DAYS,
  ROUTINE_DEPARTMENT_SLUGS,
  ROUTINE_REGULAR_SECTION_PATTERN,
  routineGroupLabel,
  routineMinutes,
  routineSectionSlug,
} from "@ourdiu/shared/constants";

// The Class Routine on the web (docs/PLAN.md, Phase 3). Client-safe helpers.

export type RoutineDepartmentSlug = (typeof ROUTINE_DEPARTMENT_SLUGS)[number];

/** A section to open: its department, name and maybe one lab group. */
export type RoutinePick = {
  department: RoutineDepartmentSlug;
  section: string;
  group: string | null;
};

/** "cse" for CSE, as the department is in addresses. */
export const departmentSlug = (department: RoutineDepartment) =>
  department.toLowerCase() as RoutineDepartmentSlug;

export function isRoutineDepartment(
  slug: string | undefined,
): slug is RoutineDepartmentSlug {
  return ROUTINE_DEPARTMENT_SLUGS.some((d) => d === slug);
}

/** /routine/cse/67_B, with ?group=B1 for one lab group; EEE's 1-2 B is /routine/eee/1-2_B. */
export function routineHref({ department, section, group }: RoutinePick) {
  return `/routine/${department}/${encodeURIComponent(routineSectionSlug(section))}${
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

/** The department a routine page is in: "cse" of /routine/cse/67_B, else null. */
export function routineDepartmentAt(pathname: string) {
  const slug = /^\/routine\/([^/]+)/.exec(pathname)?.[1];
  return isRoutineDepartment(slug) ? slug : null;
}

/**
 * The department the visitor last looked at, so Students and Teachers in the menu
 * open it again.
 */
export const ROUTINE_DEPARTMENT_COOKIE = "ourdiu_routine_department";

/** The remembered department: the last one looked at, else the saved routine's. */
export function rememberedDepartment(
  cookie: string | null | undefined,
): RoutineDepartmentSlug | null {
  const last = cookie?.match(
    new RegExp(`(?:^|;\\s*)${ROUTINE_DEPARTMENT_COOKIE}=([^;]+)`),
  )?.[1];
  if (isRoutineDepartment(last)) return last;
  return savedRoutine(cookie)?.department ?? null;
}

export function rememberDepartment(department: RoutineDepartmentSlug) {
  document.cookie = `${ROUTINE_DEPARTMENT_COOKIE}=${department}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/** /routine/cse/teachers: a department's teachers. */
export const teachersHref = (department: RoutineDepartmentSlug) =>
  `/routine/${department}/teachers`;

/**
 * The Class Routine's own places: today's classes, a department's sections
 * (Students) and its teachers. Students covers the section pages, Teachers the
 * teachers' pages.
 */
export function routinePlaces(
  pathname: string,
  department: RoutineDepartmentSlug,
) {
  const at = routineDepartmentAt(pathname);
  const teachers =
    at !== null && pathname.startsWith(`/routine/${at}/teachers`);
  return [
    {
      id: "today",
      to: "/routine",
      label: "Today",
      active: pathname === "/routine",
    },
    {
      id: "sections",
      to: `/routine/${department}`,
      label: "Students",
      active: at !== null && !teachers,
    },
    {
      id: "teachers",
      to: teachersHref(department),
      label: "Teachers",
      active: teachers,
    },
  ] as const;
}

/** A teacher's week to open: their department and initials as printed. */
export type TeacherPick = {
  department: RoutineDepartmentSlug;
  teacher: string;
};

/** What a visitor made theirs: a section (or lab group), or a teacher's week. */
export type SavedRoutine = RoutinePick | TeacherPick;

export const isTeacherPick = (pick: SavedRoutine): pick is TeacherPick =>
  "teacher" in pick;

/** /routine/cse/teachers/STA */
export const teacherHref = ({ department, teacher }: TeacherPick) =>
  `/routine/${department}/teachers/${encodeURIComponent(teacher)}`;

/** The PDF of a teacher's week (`GET /api/v1/routine/…/teachers/…/pdf`). */
export const teacherPdfHref = ({ department, teacher }: TeacherPick) =>
  `/api/v1/routine/${department}/teachers/${encodeURIComponent(teacher)}/pdf`;

/**
 * The section or teacher a visitor made theirs ("My section", "My routine"), so
 * /routine offers it first. A cookie, so the server renders the same page the
 * browser will: "cse/67_B/B1" for a section, "cse/@STA" for a teacher (no section
 * starts with "@").
 */
export const ROUTINE_COOKIE = "ourdiu_routine";

/** The saved routine a Cookie header (or `document.cookie`) holds, if any. */
export function savedRoutine(
  cookie: string | null | undefined,
): SavedRoutine | null {
  const value = cookie?.match(
    new RegExp(`(?:^|;\\s*)${ROUTINE_COOKIE}=([^;]+)`),
  )?.[1];
  if (!value) return null;
  const [department, section, group] = decodeURIComponent(value).split("/");
  if (!isRoutineDepartment(department) || !section) return null;
  if (section.startsWith("@")) {
    return section.length > 1
      ? { department, teacher: section.slice(1) }
      : null;
  }
  return { department, section, group: group || null };
}

export function saveRoutine(pick: SavedRoutine | null) {
  document.cookie = pick
    ? `${ROUTINE_COOKIE}=${encodeURIComponent(
        isTeacherPick(pick)
          ? `${pick.department}/@${pick.teacher}`
          : [pick.department, pick.section, pick.group ?? ""].join("/"),
      )}; Path=/; Max-Age=31536000; SameSite=Lax`
    : `${ROUTINE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function samePick(a: SavedRoutine | null, b: SavedRoutine | null) {
  if (!a || !b || a.department !== b.department) return false;
  if (isTeacherPick(a) || isTeacherPick(b)) {
    return isTeacherPick(a) && isTeacherPick(b) && a.teacher === b.teacher;
  }
  return a.section === b.section && a.group === b.group;
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

/**
 * Teachers matching what was typed: by initials ("sta", those starting with it
 * first), then by a word of their name ("sample"), then anywhere in the name.
 */
export function matchTeachers(
  teachers: RoutineTeacherSummary[],
  query: string,
  limit = 6,
): RoutineTeacherSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const ranked: { t: RoutineTeacherSummary; rank: number }[] = [];
  for (const t of teachers) {
    const initials = t.initials.toLowerCase();
    const name = t.name?.toLowerCase() ?? "";
    const rank =
      initials === q
        ? 0
        : initials.startsWith(q)
          ? 1
          : name.split(/[\s.]+/).some((w) => w.startsWith(q))
            ? 2
            : name.includes(q)
              ? 3
              : -1;
    if (rank >= 0) ranked.push({ t, rank });
  }
  return ranked
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((r) => r.t);
}

/** The teacher whose initials are exactly what was typed ("sta"), if any. */
export const exactTeacher = (
  teachers: RoutineTeacherSummary[],
  query: string,
) =>
  teachers.find(
    (t) => t.initials.toLowerCase() === query.trim().toLowerCase(),
  ) ?? null;

/** A teacher's name, or their initials until admins add it. */
export const teacherName = (t: { initials: string; name: string | null }) =>
  t.name ?? t.initials;

/**
 * A teacher's class in the shape a section's class has, to show it with the same
 * pieces: no teacher, the sections attending instead. A lab group's class is a lab.
 */
export function teacherClass(c: RoutineTeacherClass): ShownClass {
  return {
    ...c,
    labGroup: null,
    roomType: c.roomType ?? (c.sections.some((s) => s.labGroup) ? "lab" : null),
    teacher: null,
  };
}

/** A class as shown: a section's, or a teacher's with who attends it. */
export type ShownClass = RoutineClass & {
  sections?: RoutineTeacherClass["sections"];
};

/** Who attends a teacher's class, as students write them: "67_B1, 67_C". */
export const attendingLabel = (sections: RoutineTeacherClass["sections"]) =>
  sections
    .map((s) =>
      s.labGroup ? routineGroupLabel(s.section, s.labGroup) : s.section,
    )
    .join(", ");

/** The choice that is exactly what was typed ("67_b1" for 67_B, group B1), if any. */
export function exactSection(choices: SectionChoice[], query: string) {
  const q = squash(query);
  return choices.find((c) => squash(c.label) === q) ?? null;
}

const dayIndex = (day: RoutineDay) => ROUTINE_DAYS.indexOf(day);

/**
 * The next class to start after `now`, this week or (after the last one) next week,
 * with how many days ahead it is: 0 today, 1 tomorrow, …
 */
export function nextClass(
  classes: RoutineClass[],
  now: { day: RoutineDay; minutes: number },
): { c: RoutineClass; daysAhead: number } | null {
  const today = dayIndex(now.day);
  let best: { c: RoutineClass; key: number } | null = null;
  for (const c of classes) {
    // Minutes from now to its start, within the coming week.
    let ahead =
      ((dayIndex(c.day) - today + 7) % 7) * 1440 +
      routineMinutes(c.start) -
      now.minutes;
    if (ahead <= 0) ahead += 7 * 1440;
    if (!best || ahead < best.key) best = { c, key: ahead };
  }
  if (!best) return null;
  return {
    c: best.c,
    daysAhead: Math.floor((now.minutes + best.key) / 1440),
  };
}

/** "Today", "Tomorrow" or the day's name, for a class `daysAhead` days away. */
export function dayWord(day: RoutineDay, daysAhead: number) {
  if (daysAhead === 0) return "Today";
  if (daysAhead === 1) return "Tomorrow";
  return ROUTINE_DAY_NAMES[dayIndex(day)]!;
}

/** The day of the month of each day of this university week (Saturday to Friday), in Dhaka. */
export function weekDates(date = new Date()): Record<RoutineDay, number> {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const todayUtc = new Date(`${ymd}T00:00:00Z`);
  const today = dayIndex(dhakaNow(date).day);
  return Object.fromEntries(
    ROUTINE_DAYS.map((d, i) => [
      d,
      new Date(todayUtc.getTime() + (i - today) * 86_400_000).getUTCDate(),
    ]),
  ) as Record<RoutineDay, number>;
}

/**
 * Whether a section is a batch's or a level-term's own ("67_B", EEE's "1-2 B").
 * Retake sections ("RE_A(3C)") gather many courses at the same times; each student
 * attends only some of them.
 */
export const isRegularSection = (section: string) =>
  ROUTINE_REGULAR_SECTION_PATTERN.test(section);

/**
 * What a section belongs to: CSE's batch ("67" of 67_B) or EEE's level and term
 * ("1-2" of 1-2 B), with the section's letter; null for retakes and others.
 */
export function sectionGroup(
  section: string,
): { key: string; title: string; letter: string; name: string } | null {
  const batch = /^(\d+)_([A-Za-z]+)$/.exec(section);
  if (batch) {
    return {
      key: batch[1]!,
      title: batch[1]!,
      letter: batch[2]!,
      name: `batch ${batch[1]}`,
    };
  }
  const term = /^(\d)-(\d) ([A-Z]+)$/.exec(section);
  if (term) {
    return {
      key: `${term[1]}-${term[2]}`,
      title: `${term[1]}-${term[2]}`,
      letter: term[3]!,
      name: `level ${term[1]}, term ${term[2]}`,
    };
  }
  return null;
}

/**
 * Sections by batch or level-term, as the home lists them: the newest batch first,
 * the first level-term first; retakes and others last.
 */
export function sectionGroups(sections: string[]) {
  const groups = new Map<
    string,
    { key: string; title: string; name: string | null; sections: string[] }
  >();
  for (const section of sections) {
    const of = sectionGroup(section);
    const key = of?.key ?? "";
    const group = groups.get(key) ?? {
      key,
      title: of?.title ?? "Retakes",
      name: of ? of.name : null,
      sections: [],
    };
    group.sections.push(section);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => {
    if (!a.key || !b.key) return a.key ? -1 : b.key ? 1 : 0;
    // Batches: newest (highest) first. Level-terms: 1-1 first.
    return a.key.includes("-")
      ? a.key.localeCompare(b.key)
      : Number(b.key) - Number(a.key);
  });
}

/** Today's date in Dhaka in words: "Sunday, 4 October". */
export const dhakaDateLabel = (date = new Date()) =>
  date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Dhaka",
  });
