import {
  ROUTINE_DAY_NAMES,
  ROUTINE_DAYS,
  routineClockTime,
  routineTime,
  type RoutineDay,
  type RoutineFileClass,
} from "@ourdiu/shared";
import type { PdfText } from "./text";

// What the departments' readers share: times, lines of text, dates, and turning a
// row's cells into classes.

/** Text on one line of a page is within this many points of the line. */
export const SAME_LINE = 2;

export const TIME_RANGE = /^(\d{1,2}):(\d\d) ?- ?(\d{1,2}):(\d\d)$/;

/** "1:00" in the afternoon is 13:00: classes run from 8:30 am to 6 pm. */
export function clock(h: string, m: string) {
  const hour = Number(h);
  return routineTime((hour < 8 ? hour + 12 : hour) * 60 + Number(m));
}

/** A slot's times from "11:30-01:00": 11:30 to 13:00. */
export function timeRange(text: string) {
  const [, h1, m1, h2, m2] = TIME_RANGE.exec(text)!;
  return { start: clock(h1!, m1!), end: clock(h2!, m2!) };
}

/** Pieces of text on the same line, top line first. */
export function lines(texts: PdfText[]): PdfText[][] {
  const sorted = [...texts].sort((a, b) => b.y - a.y || a.x - b.x);
  const out: PdfText[][] = [];
  for (const t of sorted) {
    const line = out.at(-1);
    if (line && Math.abs(line[0]!.y - t.y) <= SAME_LINE) line.push(t);
    else out.push([t]);
  }
  return out;
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** "2026-10-03" for a day, a month's name and a year, or null if they aren't one. */
export function isoDate(day: string, month: string, year: string) {
  const m = MONTHS.indexOf(month.toLowerCase());
  if (m < 0) return null;
  return `${year}-${String(m + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** A class in a cell, before its times are known. */
export type Entry = {
  section: string;
  labGroup: string | null;
  course: string;
  teacher: string | null;
};

/** A slot of the grid and its times. */
export type Slot = { start: string; end: string };

/** The classes of one slot in one room. */
export type Cell = { slot: Slot; entries: Entry[] };

/** "Saturday 1:00 pm, KT-208": where a cell is, for the notes. */
export const where = (day: RoutineDay, slot: Slot, room: string) =>
  `${ROUTINE_DAY_NAMES[ROUTINE_DAYS.indexOf(day)]} ${routineClockTime(slot.start)}, ${room}`;

/**
 * A room's cells on a day, in time order, as classes: the same classes in
 * back-to-back slots are one longer class (a lab, a double class). A lab's second
 * cell sometimes leaves out the lab group: still the same lab, noted.
 */
export function rowClasses(
  day: RoutineDay,
  room: string,
  roomType: "lab" | null,
  cells: Cell[],
  notes: string[],
): RoutineFileClass[] {
  const classes: RoutineFileClass[] = [];
  const key = (cell: Cell, withGroups = true) =>
    JSON.stringify(
      cell.entries.map((e) => (withGroups ? e : { ...e, labGroup: null })),
    );
  const sorted = [...cells].sort((a, b) =>
    a.slot.start.localeCompare(b.slot.start),
  );
  for (let i = 0; i < sorted.length; i++) {
    const first = sorted[i]!;
    let last = first;
    while (sorted[i + 1]) {
      const next = sorted[i + 1]!;
      if (next.slot.start !== last.slot.end) break;
      if (key(next) !== key(first)) {
        const groupLeftOut =
          key(next, false) === key(first, false) &&
          next.entries.every((e) => e.labGroup === null);
        if (!groupLeftOut) break;
        notes.push(
          `${where(day, next.slot, room)} has no lab group; read as ${first.entries
            .map((e) =>
              e.labGroup ? `${e.section} (${e.labGroup})` : e.section,
            )
            .join(" and ")}’s lab going on.`,
        );
      }
      last = sorted[++i]!;
    }
    for (const entry of first.entries) {
      classes.push({
        day,
        start: first.slot.start,
        end: last.slot.end,
        course: entry.course,
        section: entry.section,
        labGroup: entry.labGroup,
        room,
        roomType,
        teacher: entry.teacher,
      });
    }
  }
  return classes;
}
