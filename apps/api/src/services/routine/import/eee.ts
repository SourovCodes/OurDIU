import {
  ROUTINE_DAY_NAMES,
  ROUTINE_DAYS,
  ROUTINE_FILE_FORMAT,
  ROUTINE_TEACHER_PATTERN,
  routineMinutes,
  type RoutineDay,
  type RoutineFile,
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
  type Entry,
  type Slot,
} from "./common";
import type { PdfText } from "./text";
import { readTeacherList, type TeacherListState } from "./teachers";
import type { RoutineImport } from "./types";

// EEE's routine PDF: a page per day, each a grid of rooms by one-hour slots, the
// classrooms first and the labs under a second header. A cell holds the level-term
// and section ("1-2 B"), the course with the section again and maybe a lab group
// ("0713-121 B1") and the teacher's initials. A lab fills two cells in a row; a class
// two sections share has a line for each. The last pages list the teachers, with
// their phone numbers and emails.

export const EEE_HEADING =
  "Department of Electrical and Electronic Engineering";

const LEVEL_TERM_SECTION = /^(\d-\d) ([A-Z])(\d?)$/;
const COURSE = /^(\d{4}-\d{3})(?: ([A-Z])(\d?))?$/;
const VERSION = /Version\s+(\d{1,3}(?:\.\d{1,3}){0,2})\b/;
const EFFECTIVE = /Effective from ([A-Z][a-z]+) (\d{1,2}), (\d{4})/;

/** Lines of one grid row (a cell with two sections) are this close; rows are apart more. */
const ROW_GAP = 6;
/** A room's name, maybe on several lines, sits this close to its row's middle. */
const ROOM_REACH = 13;

type Column = Slot & { left: number; right: number };

/** One grid of a page: the classrooms', or the labs'. */
type Grid = { top: number; bottom: number; lab: boolean; columns: Column[] };

/**
 * The grids of a day's page, from their header lines: a line of times and, under it,
 * a line of "L-T-S Course TI" for each slot with classes (the break has none).
 */
function grids(texts: PdfText[]): Grid[] {
  const all = lines(texts);
  const headers = all.filter((l) => l.some((t) => t.text === "L-T-S"));
  return headers.map((header, i) => {
    const y = header[0]!.y;
    const times = all
      .filter(
        (l) =>
          l[0]!.y > y &&
          l[0]!.y - y < 25 &&
          l.some((t) => TIME_RANGE.test(t.text)),
      )
      .at(-1)!;
    const slots = (times ?? [])
      .filter((t) => TIME_RANGE.test(t.text))
      .map((t) => ({ ...timeRange(t.text), center: t.x + t.width / 2 }));
    const lts = header.filter((t) => t.text === "L-T-S").map((t) => t.x);
    const ti = header.filter((t) => t.text === "TI").map((t) => t.x);
    const columns = lts.map((x, j) => {
      const tiX = ti.find((t) => t > x) ?? x + 60;
      const center = (x + tiX + 8) / 2;
      const slot = slots.reduce((best, s) =>
        Math.abs(s.center - center) < Math.abs(best.center - center) ? s : best,
      );
      return {
        start: slot.start,
        end: slot.end,
        left: x - 8,
        // Up to the next slot's cell, but not into the break between them.
        right: Math.min(lts[j + 1] ?? Infinity, tiX + 36) - 8,
      };
    });
    // The lab grid's times line starts with "Lab"; the classrooms' with "Room".
    const lab = (times ?? []).some((t) => t.text === "Lab");
    const next = headers[i + 1];
    return {
      top: y - SAME_LINE,
      bottom: next ? next[0]!.y + 25 : -Infinity,
      lab,
      columns,
    };
  });
}

/** A cell's classes: one per section in it, all with the same teacher. */
function readCell(texts: PdfText[], note: (message: string) => void): Entry[] {
  const byY = [...texts].sort((a, b) => b.y - a.y || a.x - b.x);
  const sections: RegExpExecArray[] = [];
  const courses: RegExpExecArray[] = [];
  const teachers: string[] = [];
  for (const t of byY) {
    const lts = LEVEL_TERM_SECTION.exec(t.text);
    const course = COURSE.exec(t.text);
    const last = courses.at(-1);
    if (lts) sections.push(lts);
    else if (course) courses.push(course);
    // A course whose section went onto the next line: "0531-122" over "D1".
    else if (last && !last[2] && /^[A-Z]\d?$/.test(t.text)) {
      courses[courses.length - 1] = COURSE.exec(`${last[0]} ${t.text}`)!;
    } else if (ROUTINE_TEACHER_PATTERN.test(t.text) && t.text.length <= 6) {
      teachers.push(t.text);
    } else if (/\d/.test(t.text)) {
      note(`couldn’t read “${t.text}”, left out`);
    }
    // Text without digits is a note on the grid ("Break", "Departmental Meeting").
  }
  if (!sections.length && !courses.length) return [];
  if (!sections.length || !courses.length) {
    note(
      `couldn’t read “${byY.map((t) => t.text).join(" ")}”: it needs both the section and the course, left out`,
    );
    return [];
  }
  if (teachers.length > 1) {
    note(`has two teachers, ${teachers.join(" and ")}; read as ${teachers[0]}`);
  }
  const count = Math.max(sections.length, courses.length);
  if (sections.length !== courses.length && sections.length > 1) {
    note(
      `has ${sections.length} sections but ${courses.length} courses; read line by line`,
    );
  }
  const entries: Entry[] = [];
  for (let i = 0; i < count; i++) {
    const [, levelTerm, letter, digit] =
      sections[Math.min(i, sections.length - 1)]!;
    const [, code, courseLetter, courseDigit] =
      courses[Math.min(i, courses.length - 1)]!;
    if (courseLetter && courseLetter !== letter) {
      note(
        `says ${levelTerm} ${letter} but ${code} ${courseLetter}${courseDigit}; read as ${levelTerm} ${letter}`,
      );
    }
    const group = digit || courseDigit;
    entries.push({
      section: `${levelTerm} ${letter}`,
      labGroup: group ? `${letter}${group}` : null,
      course: code!,
      teacher: teachers[0] ?? null,
    });
  }
  return entries;
}

/**
 * A piece of text holding a cell's parts, or even two cells ("1-1 R 0231-112 R1 MNA"),
 * split into its parts, each placed where its characters start.
 */
function pieces(t: PdfText): PdfText[] {
  // Words without digits are notes on the grid ("OBE Session"), kept whole.
  if (!/\d/.test(t.text)) return [t];
  const parts = [
    ...t.text.matchAll(
      /\d-\d [A-Z]\d?(?= |$)|\d{4}-\d{3}(?: [A-Z]\d?)?(?= |$)|\S+/g,
    ),
  ];
  if (parts.length <= 1) return [t];
  return parts.map((m) => ({
    x: t.x + (t.width * m.index) / t.text.length,
    y: t.y,
    width: (t.width * m[0].length) / t.text.length,
    text: m[0],
  }));
}

const NUMBERED_ROOM = /^[A-Z]?\d{3}[A-Z]?$/;
/** A cell's text is in a numbered room's row when this close to the number. */
const ROW_REACH = 5;

/**
 * The grid's rows, with their rooms. Most rooms are a number ("302"), level with their
 * row (a cell with two sections has a line above it and one below). Others are named
 * over several lines ("Civil-A (303) Chemistry Lab"): their rows are the rest of the
 * text, in runs close together, each named by the lines around it.
 */
function rowsOf(
  cells: PdfText[],
  roomTexts: PdfText[],
): { room: string; texts: PdfText[] }[] {
  const numbered = roomTexts
    .filter((t) => NUMBERED_ROOM.test(t.text))
    .map((t) => ({ room: t.text, y: t.y, texts: [] as PdfText[] }));
  const rest: PdfText[] = [];
  for (const t of cells) {
    let nearest: (typeof numbered)[number] | null = null;
    for (const row of numbered) {
      const d = Math.abs(row.y - t.y);
      if (d <= ROW_REACH && (!nearest || d < Math.abs(nearest.y - t.y))) {
        nearest = row;
      }
    }
    if (nearest) nearest.texts.push(t);
    else rest.push(t);
  }

  const runs: PdfText[][] = [];
  for (const t of rest.sort((a, b) => b.y - a.y)) {
    const run = runs.at(-1);
    if (run && run.at(-1)!.y - t.y <= ROW_GAP) run.push(t);
    else runs.push([t]);
  }
  const middles = runs.map((run) => (run[0]!.y + run.at(-1)!.y) / 2);
  const names = runs.map((): PdfText[] => []);
  for (const t of roomTexts) {
    if (NUMBERED_ROOM.test(t.text)) continue;
    let nearest = -1;
    for (let i = 0; i < middles.length; i++) {
      const d = Math.abs(middles[i]! - t.y);
      if (
        d <= ROOM_REACH &&
        (nearest < 0 || d < Math.abs(middles[nearest]! - t.y))
      ) {
        nearest = i;
      }
    }
    if (nearest >= 0) names[nearest]!.push(t);
  }
  return [
    ...numbered,
    ...runs.map((texts, i) => ({
      room: names[i]!.sort((a, b) => b.y - a.y)
        .map((t) => t.text)
        .join(" "),
      texts,
    })),
  ].filter((row) => row.texts.length > 0);
}

/** One day's page: its classes, a lab or a double class over two slots as one. */
function readDay(
  day: RoutineDay,
  texts: PdfText[],
  notes: string[],
): { classes: RoutineFileClass[]; slots: Column[] } {
  const classes: RoutineFileClass[] = [];
  const slots: Column[] = [];
  for (const grid of grids(texts)) {
    slots.push(...grid.columns);
    const left = Math.min(...grid.columns.map((c) => c.left));
    const inGrid = texts.filter((t) => t.y < grid.top && t.y > grid.bottom);
    const cells = inGrid.filter((t) => t.x >= left).flatMap(pieces);
    const roomTexts = inGrid.filter((t) => t.x < left);

    rowsOf(cells, roomTexts).forEach(({ room, texts: row }) => {
      const cellsOfRow: Cell[] = [];
      for (const column of grid.columns) {
        const texts = row.filter(
          (t) => t.x >= column.left && t.x < column.right,
        );
        if (!texts.length) continue;
        const entries = readCell(texts, (message) =>
          notes.push(
            `${where(day, column, room || "a room without a name")} ${message}.`,
          ),
        );
        if (entries.length && !room) {
          notes.push(
            `${where(day, column, "a row")}: couldn’t find the room of “${texts.map((t) => t.text).join(" ")}”, left out.`,
          );
          continue;
        }
        if (entries.length) cellsOfRow.push({ slot: column, entries });
      }
      classes.push(
        ...rowClasses(day, room, grid.lab ? "lab" : null, cellsOfRow, notes),
      );
    });
  }
  return { classes, slots };
}

export function readEeeRoutine(pages: PdfText[][]): RoutineImport {
  const notes: string[] = [];
  const classes: RoutineFileClass[] = [];
  const slots = new Map<string, { start: string; end: string }>();
  const teachers: NonNullable<RoutineFile["teachers"]> = {};
  const teacherList: TeacherListState = {};
  let version: string | null = null;
  let publishedOn: string | null = null;

  for (const texts of pages) {
    const all = texts.map((t) => t.text).join("\n");
    version ??= VERSION.exec(all)?.[1] ?? null;
    const effective = EFFECTIVE.exec(all);
    if (effective) {
      publishedOn ??= isoDate(effective[2]!, effective[1]!, effective[3]!);
    }
    if (/Teachers.? Information/i.test(all)) {
      readTeacherList(texts, teachers, teacherList);
      continue;
    }
    const dayName = texts.find((t) =>
      (ROUTINE_DAY_NAMES as readonly string[]).includes(t.text),
    )?.text;
    if (!dayName) continue;
    const day =
      ROUTINE_DAYS[(ROUTINE_DAY_NAMES as readonly string[]).indexOf(dayName)]!;
    const read = readDay(day, texts, notes);
    classes.push(...read.classes);
    for (const s of read.slots)
      slots.set(s.start, { start: s.start, end: s.end });
  }

  const file: RoutineFile = {
    format: ROUTINE_FILE_FORMAT,
    department: "EEE",
    version: version ?? "",
    publishedOn,
    slots: [...slots.values()].sort(
      (a, b) => routineMinutes(a.start) - routineMinutes(b.start),
    ),
    teachers,
    classes,
  };
  return { file, notes };
}
