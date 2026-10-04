import {
  ROUTINE_DAY_NAMES,
  ROUTINE_DAYS,
  ROUTINE_FILE_FORMAT,
  ROUTINE_TEACHER_PATTERN,
  type RoutineDay,
  type RoutineFileClass,
} from "@ourdiu/shared";
import {
  isoDate,
  rowClasses,
  TIME_RANGE,
  timeRange,
  where,
  type Cell,
  type Slot,
} from "./common";
import type { RoutineImport } from "./types";
import type { SheetCells } from "./xlsx";

// SWE's routine, an Excel sheet: "Effective from 03 October, 2026" and the
// department's name at the top, then the 90-minute slots' times over a "Class |
// Course | Teacher | Course | Teacher …" header. Each day follows under a row with
// its name ("Saturday"); each row under it is a room ("611", "Annex - 409 (LAB)",
// "G1-007 (COM LAB)", "ONLINE") with, per slot, the course with its batch and
// section ("SE441-40-E"; lab group "SE233-44-G2"; a major's section
// "DS421-41-DSC") and the teacher's initials. A lab fills two slots in a row. The
// sheet has no version number (it's in the file's name, or given on upload), no
// course titles and no teachers' names. "UC" sections (SE221-UC-A) aren't a
// batch's: like CSE's retakes, they're left out.

export const SWE_HEADING = "Department of Software Engineering";

const EFFECTIVE = /Effective from:?\s+(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})/i;
const DAYS = ROUTINE_DAY_NAMES.map((d) => d.toLowerCase());
/** SE441-40-E, SE233-44-G2 (lab group G2 of 44_G), DS421-41-DSC, SE221-UC-A. */
const COURSE_SECTION =
  /^([A-Z]{2,6}\d{2,4}[A-Z]?)-+(\d{1,3}|UC)-+([A-Z]{1,4})(\d{1,2})?$/;
/** A room marked as a lab: "Annex - 409 (LAB)", "G1-007 (COM LAB)". */
const LAB_ROOM = /\s*\((?:COM\s+)?LAB\)\s*$/i;

/** "Annex - 409 (LAB)" as "Annex-409", a lab; "ONLINE" as "Online". */
function roomOf(text: string): { room: string; roomType: "lab" | null } {
  const roomType = LAB_ROOM.test(text) ? "lab" : null;
  let room = text
    .replace(LAB_ROOM, "")
    .replace(/\s*-\s*/g, "-")
    .trim();
  if (/^online$/i.test(room)) room = "Online";
  return { room, roomType };
}

/** A version number in the file's name: "…studentversion04.xlsx" is "4". */
export function versionInName(name: string | undefined) {
  const match = /version[\s_-]*0*(\d{1,3}(?:\.\d{1,3}){0,2})/i.exec(name ?? "");
  return match?.[1] ?? null;
}

export function readSweRoutine(
  sheet: SheetCells,
  version: string,
): RoutineImport {
  const notes: string[] = [];
  const rows = [...sheet.keys()].sort((a, b) => a - b);
  const text = (row: number, column: number) =>
    sheet.get(row)?.get(column)?.trim() ?? "";

  let publishedOn: string | null = null;
  for (const row of rows.slice(0, 5)) {
    for (const cell of sheet.get(row)!.values()) {
      const m = EFFECTIVE.exec(cell);
      if (m) publishedOn ??= isoDate(m[1]!, m[2]!, m[3]!);
    }
  }

  // The header row, and the slots' times in the row above it.
  const header = rows.find(
    (row) =>
      [...sheet.get(row)!.values()].filter((t) => t.trim() === "Course")
        .length > 0 &&
      [...sheet.get(row)!.values()].some((t) => t.trim() === "Teacher"),
  );
  const columns: (Slot & { course: number })[] = [];
  if (header !== undefined) {
    for (const [column, label] of sheet.get(header)!) {
      if (label.trim() !== "Course") continue;
      const time = text(header - 1, column)
        .replace(/\./g, ":")
        .replace(/\s+/g, "");
      if (TIME_RANGE.test(time))
        columns.push({ ...timeRange(time), course: column });
      else
        notes.push(`The slot over column ${column} has no time ("${time}").`);
    }
  }
  columns.sort((a, b) => a.start.localeCompare(b.start));

  const classes: RoutineFileClass[] = [];
  const leftOut = new Set<string>();
  let day: RoutineDay | null = null;
  for (const row of rows.filter((r) => header !== undefined && r > header)) {
    const first = text(row, 1);
    const dayIndex = DAYS.indexOf(first.toLowerCase());
    if (dayIndex >= 0) {
      day = ROUTINE_DAYS[dayIndex]!;
      continue;
    }
    if (!day || !first) continue;
    const { room, roomType } = roomOf(first);
    const cells: Cell[] = [];
    for (const slot of columns) {
      const printed = text(row, slot.course);
      if (!printed) continue;
      const m = COURSE_SECTION.exec(printed.replace(/\s+/g, ""));
      if (!m) {
        notes.push(`${where(day, slot, room)}: couldn’t read “${printed}”.`);
        continue;
      }
      const [, course, batch, letters, group] = m;
      if (batch === "UC") {
        leftOut.add(`${course} (UC_${letters}${group ?? ""})`);
        continue;
      }
      const initials = text(row, slot.course + 1);
      const teacher = ROUTINE_TEACHER_PATTERN.test(initials) ? initials : null;
      if (initials && !teacher) {
        notes.push(
          `${where(day, slot, room)}: “${initials}” isn’t a teacher’s initials; left without a teacher.`,
        );
      }
      cells.push({
        slot,
        entries: [
          {
            course: course!,
            section: `${batch}_${letters}`,
            labGroup: group ? `${letters}${group}` : null,
            teacher,
          },
        ],
      });
    }
    classes.push(...rowClasses(day, room, roomType, cells, notes));
  }
  if (leftOut.size) {
    notes.push(
      `Left out, as they aren’t a batch’s sections: ${[...leftOut].join(", ")}.`,
    );
  }

  return {
    file: {
      format: ROUTINE_FILE_FORMAT,
      department: "SWE",
      version,
      publishedOn,
      slots: columns.map(({ start, end }) => ({ start, end })),
      classes,
    },
    notes,
  };
}
