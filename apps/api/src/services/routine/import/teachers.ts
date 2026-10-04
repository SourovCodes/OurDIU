import { ROUTINE_TEACHER_PATTERN, type RoutineFile } from "@ourdiu/shared";
import { lines } from "./common";
import type { PdfText } from "./text";

// A department's list of teachers in its routine PDF: name, initials, phone and
// email in columns (EEE's "Course Teachers' Information"). Continued over pages, the
// list has its header on the first one only.

const PHONE = /^\+?[\d\s-]{7,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What a page of the list tells the next: where the initials column is. */
export type TeacherListState = { initialColumn?: number };

/** Adds each teacher on the page to `teachers`, by initials. */
export function readTeacherList(
  texts: PdfText[],
  teachers: NonNullable<RoutineFile["teachers"]>,
  state: TeacherListState,
) {
  const all = lines(texts);
  const header = all.find(
    (l) =>
      l.some((t) => t.text === "Initial") && l.some((t) => t.text === "Name"),
  );
  if (header) state.initialColumn = header.find((t) => t.text === "Initial")!.x;
  const { initialColumn } = state;
  for (const line of all) {
    const initials = line.find(
      (t) =>
        ROUTINE_TEACHER_PATTERN.test(t.text) &&
        t.text.length <= 8 &&
        t.text !== "Initial" &&
        (initialColumn === undefined || Math.abs(t.x - initialColumn) < 25),
    );
    if (!initials) continue;
    const name = line
      .filter((t) => t.x < initials.x - 2)
      .map((t) => t.text)
      .join(" ");
    if (!/^[A-Z][A-Za-z.\s'-]+$/.test(name) || !/\s/.test(name)) continue;
    const rest = line.filter((t) => t.x > initials.x);
    const phone = rest.find((t) => PHONE.test(t.text))?.text;
    const email = rest.find((t) => EMAIL.test(t.text))?.text;
    teachers[initials.text] = {
      name,
      phone: phone?.replace(/[\s-]/g, "") ?? null,
      email: email?.toLowerCase() ?? null,
    };
  }
}
