import {
  ROUTINE_DAY_NAMES,
  ROUTINE_DAYS,
  ROUTINE_FILE_FORMAT,
  ROUTINE_SECTION_PATTERN,
  ROUTINE_TEACHER_PATTERN,
  routineMinutes,
  type RoutineDay,
  type RoutineFileClass,
} from "@ourdiu/shared";
import {
  isoDate,
  lines,
  rowClasses,
  SAME_LINE,
  TIME_RANGE,
  timeRange,
  where,
  type Cell,
  type Slot,
} from "./common";
import type { PdfText } from "./text";
import type { RoutineImport } from "./types";

// CSE's routine PDF: the days one after another, a day starting anywhere on a page
// ("SUNDAY") and running on over the next pages. Each day is a grid of rows by
// 90-minute slots, each slot's cell with its room, course and teacher: the room again
// in every cell ("KT-208", or "G1-003" over "(COM LAB)" for a lab), the course with
// its section ("CSE315(67_I)", lab group "CSE322(67_J1)"), the teacher's initials. A
// lab fills two cells in a row. Course titles and teachers' names aren't in it.

export const CSE_HEADING = "Class Routine for CSE Program";

const VERSION = /Version\s+V?(\d{1,3}(?:\.\d{1,3}){0,2})\b/;
const EFFECTIVE = /Effective From:?\s+(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})/;
const DAYS = ROUTINE_DAY_NAMES.map((d) => d.toUpperCase());
const COURSE_SECTION = /^([A-Z]{2,6}\d{2,4}[A-Z]?)\((.+)\)$/;
/** Something written like a course that isn't one: "CSE322(67_J1" cut short. */
const COURSE_LIKE = /^[A-Z]{2,6}\d{3}/;
/** A room's name as the first line of its cell: KT-318(A), G1-003, CTBA-01. */
const ROOM = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+(?:\([A-Z0-9]{1,3}\))?$/;
/** A regular section's lab group: 67_J1 is group J1 of 67_J. */
const LAB_GROUP = /^(\d+_([A-Z]+))(\d+)$/;
/** A room's name is at most this far above its cell's course, over several lines… */
const ROOM_REACH = 32;
/** …or this far under it, below a label line. */
const ROOM_BELOW = 8;
/** A course's text going on over the next line is this close under it. */
const WRAP_REACH = 14;

/** Where each slot's cell is across the page, from a "Room Course Teacher" header. */
type Column = Slot & {
  left: number;
  right: number;
  /** Text starting left of this is the room's; right of `teacher` the teacher's. */
  course: number;
  teacher: number;
};

function columnsOf(all: PdfText[][]): Column[] | null {
  const header = all.find(
    (l) =>
      l.some((t) => t.text === "Room") &&
      l.some((t) => t.text === "Course") &&
      l.some((t) => t.text === "Teacher"),
  );
  if (!header) return null;
  const y = header[0]!.y;
  const times = all.find(
    (l) =>
      l[0]!.y > y && l[0]!.y - y < 25 && l.some((t) => TIME_RANGE.test(t.text)),
  );
  if (!times) return null;
  const slots = times
    .filter((t) => TIME_RANGE.test(t.text))
    .map((t) => ({ ...timeRange(t.text), center: t.x + t.width / 2 }));
  const rooms = header.filter((t) => t.text === "Room");
  const courses = header.filter((t) => t.text === "Course");
  const teachers = header.filter((t) => t.text === "Teacher");
  return rooms.map((room, i) => {
    const course = courses.find((t) => t.x > room.x) ?? room;
    const teacher = teachers.find((t) => t.x > course.x) ?? course;
    const center = (room.x + teacher.x + teacher.width) / 2;
    const slot = slots.reduce((best, s) =>
      Math.abs(s.center - center) < Math.abs(best.center - center) ? s : best,
    );
    // A room's name over several lines starts left of its header.
    const left = room.x - 22;
    return {
      start: slot.start,
      end: slot.end,
      left,
      right: rooms[i + 1] ? rooms[i + 1]!.x - 22 : Infinity,
      course: (room.x + course.x) / 2,
      teacher: teacher.x - 10,
    };
  });
}

/**
 * A section as it's meant, from slips in the PDF: "RE_A (3C.)" is RE_A(3C), and
 * "RE_A1(1.5C" (its bracket left out) RE_A1(1.5C).
 */
function tidySection(printed: string) {
  let section = printed.replace(/\s+/g, "").replace(/C\.(?=\)|$)/g, "C");
  const open = section.split("(").length - section.split(")").length;
  if (open > 0) section += ")".repeat(open);
  return section;
}

/** The section and lab group a course's brackets hold: 67_J1 is 67_J, group J1. */
function sectionOf(inside: string) {
  const section = tidySection(inside);
  const group = LAB_GROUP.exec(section);
  return group
    ? { section: group[1]!, labGroup: `${group[2]}${group[3]}` }
    : { section, labGroup: null };
}

export function readCseRoutine(pages: PdfText[][]): RoutineImport {
  const notes: string[] = [];
  /** Sections tidied from a slip, noted once each. */
  const tidied = new Set<string>();
  const slots = new Map<string, Slot>();
  /** Each room's cells on each day: "SAT KT-208". */
  const rows = new Map<
    string,
    { day: RoutineDay; room: string; lab: boolean; cells: Cell[] }
  >();
  let version: string | null = null;
  let publishedOn: string | null = null;
  let columns: Column[] | null = null;
  let day: RoutineDay | null = null;

  for (const texts of pages) {
    const all = texts.map((t) => t.text).join("\n");
    version ??= VERSION.exec(all)?.[1] ?? null;
    const effective = EFFECTIVE.exec(all);
    if (effective) {
      publishedOn ??= isoDate(effective[1]!, effective[2]!, effective[3]!);
    }
    const pageLines = lines(texts);
    // The columns stay put; a page continuing a day has no header of its own.
    columns = columnsOf(pageLines) ?? columns;
    if (!columns) continue;
    for (const c of columns) slots.set(c.start, { start: c.start, end: c.end });

    // Days starting on this page, top first: the text under each is its day's.
    const starts = texts
      .filter((t) => DAYS.includes(t.text))
      .map((t) => ({
        y: t.y,
        day: ROUTINE_DAYS[DAYS.indexOf(t.text)]!,
      }))
      .sort((a, b) => b.y - a.y);
    const dayAt = (y: number) =>
      starts.filter((s) => s.y > y).at(-1)?.day ?? day;

    const columnOf = (t: PdfText) =>
      columns!.find((c) => t.x >= c.left && t.x < c.right);
    const inCourses = (t: PdfText, c: Column) =>
      t.x >= c.course && t.x < c.teacher;
    const used = new Set<PdfText>();

    for (const piece of texts) {
      const column = columnOf(piece);
      if (!column || !inCourses(piece, column) || used.has(piece)) continue;
      // A course too long for its cell goes on over the next line:
      // "CSE325(RE_A(3C)(D" over "MML))". Its line is then the middle of the two.
      let t = piece;
      const open = (text: string) =>
        text.split("(").length - text.split(")").length;
      if (open(t.text) > 0) {
        const rest = texts
          .filter(
            (u) =>
              u !== t &&
              inCourses(u, column) &&
              columnOf(u) === column &&
              u.y < t.y &&
              t.y - u.y <= WRAP_REACH,
          )
          .sort((a, b) => b.y - a.y)[0];
        if (rest && !COURSE_LIKE.test(rest.text)) {
          used.add(rest);
          t = { ...t, y: (t.y + rest.y) / 2, text: `${t.text}${rest.text}` };
        }
      }
      const course = COURSE_SECTION.exec(t.text);
      if (!course) {
        if (COURSE_LIKE.test(t.text)) {
          const on = dayAt(t.y);
          notes.push(
            `${on ? where(on, column, "a cell") : "A cell"}: couldn’t read “${t.text}”, left out.`,
          );
        }
        continue;
      }
      const on = dayAt(t.y);
      if (!on) continue;

      // The room is the room name nearest the course's line in the same cell: level
      // with it, above it when the room's name runs over several lines, or just
      // under a label ("EMBED" over "LAB-KT-301"). The lines around it say what
      // kind of room it is.
      const inCell = (u: PdfText) => u.x >= column.left && u.x < column.course;
      const room = texts
        .filter(
          (u) =>
            inCell(u) &&
            ROOM.test(u.text) &&
            u.y - t.y >= -ROOM_BELOW &&
            u.y - t.y <= ROOM_REACH,
        )
        .sort((a, b) => Math.abs(a.y - t.y) - Math.abs(b.y - t.y))[0];
      if (!room) {
        notes.push(
          `${where(on, column, "a cell")}: couldn’t find the room of ${t.text}, left out.`,
        );
        continue;
      }
      const nextRoom = texts
        .filter((u) => inCell(u) && ROOM.test(u.text) && u.y < room.y)
        .sort((a, b) => b.y - a.y)[0];
      const kind = texts.filter(
        (u) =>
          inCell(u) &&
          u.y <= room.y + ROOM_BELOW + SAME_LINE &&
          u.y > (nextRoom?.y ?? -Infinity) &&
          room.y - u.y < 60,
      );
      const lab = kind.some((u) => /\blab\b/i.test(u.text));

      const teacherText = texts
        .filter(
          (u) =>
            u.x >= column.teacher &&
            u.x < column.right &&
            Math.abs(u.y - t.y) <= SAME_LINE + 1,
        )
        .sort((a, b) => Math.abs(a.y - t.y) - Math.abs(b.y - t.y))[0]?.text;
      let teacher: string | null = null;
      if (teacherText && ROUTINE_TEACHER_PATTERN.test(teacherText)) {
        teacher = teacherText;
      } else if (teacherText) {
        notes.push(
          `${where(on, column, room.text)}: couldn’t read the teacher “${teacherText}”, read without one.`,
        );
      }

      const { section, labGroup } = sectionOf(course[2]!);
      if (tidySection(course[2]!) !== course[2] && !tidied.has(course[2]!)) {
        tidied.add(course[2]!);
        notes.push(
          `${where(on, column, room.text)}: section “${course[2]}” read as ${section}${labGroup ? ` (lab group ${labGroup})` : ""}, here and wherever else it’s written so.`,
        );
      }
      if (!ROUTINE_SECTION_PATTERN.test(section)) {
        notes.push(
          `${where(on, column, room.text)}: couldn’t read the section of “${t.text}”, left out.`,
        );
        continue;
      }
      const key = `${on} ${room.text}`;
      const row = rows.get(key) ?? {
        day: on,
        room: room.text,
        lab,
        cells: [],
      };
      row.lab ||= lab;
      const entry = { section, labGroup, course: course[1]!, teacher };
      const cell = row.cells.find((c) => c.slot.start === column.start);
      if (cell) cell.entries.push(entry);
      else row.cells.push({ slot: column, entries: [entry] });
      rows.set(key, row);
    }
    day = starts.at(-1)?.day ?? day;
  }

  const classes: RoutineFileClass[] = [];
  for (const row of rows.values()) {
    for (const cell of row.cells) {
      cell.entries.sort((a, b) =>
        `${a.section} ${a.labGroup}`.localeCompare(
          `${b.section} ${b.labGroup}`,
        ),
      );
    }
    classes.push(
      ...rowClasses(
        row.day,
        row.room,
        row.lab ? "lab" : null,
        row.cells,
        notes,
      ),
    );
  }
  classes.sort(
    (a, b) =>
      ROUTINE_DAYS.indexOf(a.day) - ROUTINE_DAYS.indexOf(b.day) ||
      routineMinutes(a.start) - routineMinutes(b.start) ||
      a.room.localeCompare(b.room),
  );

  return {
    file: {
      format: ROUTINE_FILE_FORMAT,
      department: "CSE",
      version: version ?? "",
      publishedOn,
      slots: [...slots.values()].sort(
        (a, b) => routineMinutes(a.start) - routineMinutes(b.start),
      ),
      classes,
    },
    notes,
  };
}
