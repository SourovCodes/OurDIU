import {
  ROUTINE_DAY_NAMES,
  ROUTINE_DAYS,
  routineClockTime,
  routineTime,
  type AdminRoutineVersionDetail,
  type RoutineChange,
  type RoutineChangedClass,
  type RoutineDay,
  type RoutineWarning,
} from "@ourdiu/shared";

// Checks on a routine that don't stop an upload (things DIU's routine sometimes really
// has, or slips made turning its PDF into the file), and what changed between two
// versions. Both are pure, over classes with times in minutes.

/** A class as the checks see it: times in minutes since midnight. */
export type CheckedClass = {
  day: RoutineDay;
  start: number;
  end: number;
  course: string;
  section: string;
  labGroup: string | null;
  room: string;
  teacher: string | null;
};

/** At most this many warnings are kept with a version. */
export const MAX_STORED_WARNINGS = 200;
/** At most this many changes are listed in a review. */
export const MAX_LISTED_CHANGES = 300;

const dayName = (day: RoutineDay) =>
  ROUTINE_DAY_NAMES[ROUTINE_DAYS.indexOf(day)];
const at = (c: CheckedClass) =>
  `${dayName(c.day)} at ${routineClockTime(routineTime(c.start))}`;
const sectionLabel = (c: CheckedClass) =>
  c.labGroup ? `${c.section} (${c.labGroup})` : c.section;
/** A batch's section ("67_B"), not a retake or other mixed section. */
export const isRegularSection = (section: string) =>
  /^\d+_[A-Za-z]+$/.test(section);
const overlaps = (a: CheckedClass, b: CheckedClass) =>
  a.day === b.day && a.start < b.end && b.start < a.end;
const sameClass = (a: CheckedClass, b: CheckedClass) =>
  a.day === b.day &&
  a.start === b.start &&
  a.end === b.end &&
  a.course === b.course &&
  a.section === b.section &&
  a.labGroup === b.labGroup &&
  a.room === b.room &&
  a.teacher === b.teacher;

function groupBy<T>(items: T[], key: (item: T) => string | null) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (k === null) continue;
    const group = groups.get(k);
    if (group) group.push(item);
    else groups.set(k, [item]);
  }
  return groups;
}

/** Pairs of overlapping classes within each group, each pair once. */
function* clashes(
  groups: Map<string, CheckedClass[]>,
  counts: (a: CheckedClass, b: CheckedClass) => boolean,
): Generator<[CheckedClass, CheckedClass]> {
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!;
        const b = group[j]!;
        if (overlaps(a, b) && !sameClass(a, b) && counts(a, b)) yield [a, b];
      }
    }
  }
}

/**
 * What may be wrong with a routine: a class listed twice, a section (or a lab group)
 * in two places at once, a room or a teacher booked twice, a course without a title.
 * Returns every warning; the caller keeps the first `MAX_STORED_WARNINGS`.
 */
export function routineWarnings(
  classes: CheckedClass[],
  knownTitles: ReadonlySet<string>,
): RoutineWarning[] {
  const warnings: RoutineWarning[] = [];

  const seen: CheckedClass[] = [];
  for (const c of classes) {
    if (seen.some((s) => sameClass(s, c))) {
      warnings.push({
        kind: "duplicate",
        message: `${sectionLabel(c)} has ${c.course} in ${c.room} on ${at(c)} twice.`,
      });
    } else seen.push(c);
  }

  // A lab group attends its own labs and the whole section's classes. Retake
  // sections ("RE_A(3C)") gather many courses at once by design: not a clash.
  for (const [a, b] of clashes(
    groupBy(seen, (c) => (isRegularSection(c.section) ? c.section : null)),
    (a, b) => !a.labGroup || !b.labGroup || a.labGroup === b.labGroup,
  )) {
    warnings.push({
      kind: "section_clash",
      message: `${a.section} has two classes on ${at(a)}: ${a.course}${a.labGroup ? ` (${a.labGroup})` : ""} in ${a.room} and ${b.course}${b.labGroup ? ` (${b.labGroup})` : ""} in ${b.room}.`,
    });
  }
  for (const [a, b] of clashes(
    groupBy(seen, (c) => c.room),
    // The same course for two sections in one room is a combined class.
    (a, b) => a.course !== b.course,
  )) {
    warnings.push({
      kind: "room_clash",
      message: `${a.room} has two classes on ${at(a)}: ${sectionLabel(a)} (${a.course}) and ${sectionLabel(b)} (${b.course}).`,
    });
  }
  for (const [a, b] of clashes(
    groupBy(seen, (c) => c.teacher),
    // Teaching two sections together in one room is a combined class.
    (a, b) => a.room !== b.room,
  )) {
    warnings.push({
      kind: "teacher_clash",
      message: `${a.teacher} teaches two classes on ${at(a)}: ${sectionLabel(a)} in ${a.room} and ${sectionLabel(b)} in ${b.room}.`,
    });
  }

  const untitled = [...new Set(seen.map((c) => c.course))]
    .filter((code) => !knownTitles.has(code))
    .sort();
  if (untitled.length) {
    warnings.push({
      kind: "untitled_course",
      message:
        untitled.length === 1
          ? `${untitled[0]} has no course title in this file or an earlier version, so students see only the code.`
          : `${untitled.length} courses have no title in this file or an earlier version, so students see only their codes: ${untitled.join(", ")}.`,
    });
  }
  return warnings;
}

type Changes = AdminRoutineVersionDetail["changes"];

const changed = (c: CheckedClass): RoutineChangedClass => ({
  day: c.day,
  start: routineTime(c.start),
  end: routineTime(c.end),
  course: c.course,
  labGroup: c.labGroup,
  room: c.room,
  teacher: c.teacher,
});
const order = (a: CheckedClass, b: CheckedClass) =>
  ROUTINE_DAYS.indexOf(a.day) - ROUTINE_DAYS.indexOf(b.day) ||
  a.start - b.start;
const sameTime = (a: CheckedClass, b: CheckedClass) =>
  a.day === b.day && a.start === b.start && a.end === b.end;
export const compareSections = (a: string, b: string) =>
  a.localeCompare(b, "en", { numeric: true });

/**
 * What changed from one version to the next, section by section. A class is the same
 * course for the same section (and lab group): kept in place, moved to another time,
 * or given another room or teacher. Sections that are new or gone are listed by name,
 * without their classes.
 */
export function routineChanges(
  before: CheckedClass[],
  after: CheckedClass[],
): Changes {
  const result: Changes = {
    moved: 0,
    room: 0,
    teacher: 0,
    added: 0,
    removed: 0,
    sectionsAdded: [],
    sectionsRemoved: [],
    items: [],
  };
  const beforeSections = groupBy(before, (c) => c.section);
  const afterSections = groupBy(after, (c) => c.section);
  result.sectionsAdded = [...afterSections.keys()]
    .filter((s) => !beforeSections.has(s))
    .sort(compareSections);
  result.sectionsRemoved = [...beforeSections.keys()]
    .filter((s) => !afterSections.has(s))
    .sort(compareSections);

  const changes: { change: RoutineChange; at: CheckedClass }[] = [];
  const add = (
    kind: RoutineChange["kind"],
    a: CheckedClass | null,
    b: CheckedClass | null,
  ) => {
    result[kind]++;
    const at = (a ?? b)!;
    changes.push({
      change: {
        section: at.section,
        kind,
        before: a && changed(a),
        after: b && changed(b),
      },
      at,
    });
  };

  const key = (c: CheckedClass) =>
    `${c.section}|${c.labGroup ?? ""}|${c.course}`;
  const beforeByKey = groupBy(
    before.filter((c) => afterSections.has(c.section)),
    key,
  );
  const afterByKey = groupBy(
    after.filter((c) => beforeSections.has(c.section)),
    key,
  );
  for (const k of new Set([...beforeByKey.keys(), ...afterByKey.keys()])) {
    const old = [...(beforeByKey.get(k) ?? [])].sort(order);
    const now = [...(afterByKey.get(k) ?? [])].sort(order);
    // Unchanged classes.
    for (let i = old.length - 1; i >= 0; i--) {
      const j = now.findIndex((c) => sameClass(c, old[i]!));
      if (j >= 0) {
        old.splice(i, 1);
        now.splice(j, 1);
      }
    }
    // Same time, another room or teacher.
    for (let i = old.length - 1; i >= 0; i--) {
      const j = now.findIndex((c) => sameTime(c, old[i]!));
      if (j >= 0) {
        const [a] = old.splice(i, 1);
        const [b] = now.splice(j, 1);
        add(a!.room === b!.room ? "teacher" : "room", a!, b!);
      }
    }
    // Moved, paired in week order.
    while (old.length && now.length) add("moved", old.shift()!, now.shift()!);
    for (const a of old) add("removed", a, null);
    for (const b of now) add("added", null, b);
  }

  result.items = changes
    .sort(
      (a, b) =>
        compareSections(a.at.section, b.at.section) || order(a.at, b.at),
    )
    .slice(0, MAX_LISTED_CHANGES)
    .map((c) => c.change);
  return result;
}
