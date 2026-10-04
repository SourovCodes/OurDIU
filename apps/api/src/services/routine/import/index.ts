import {
  routineFilePath,
  routineFileSchema,
  type RoutineFileProblem,
} from "@ourdiu/shared";
import { AppError } from "../../../lib/errors";
import { CSE_HEADING, readCseRoutine } from "./cse";
import { EEE_HEADING, readEeeRoutine } from "./eee";
import { readSweRoutine, SWE_HEADING, versionInName } from "./swe";
import { pdfText } from "./text";
import type { RoutineImport } from "./types";
import { isZip, sheetCells, type SheetCells } from "./xlsx";

// Reading a routine from the file DIU publishes: a PDF (CSE, EEE) or an Excel sheet
// (SWE). Each department lays its routine out its own way, so each has its own
// reader, found by the heading on the PDF's first page or at the top of the sheet;
// a file no reader knows is refused.

const READERS = [
  { department: "CSE", heading: CSE_HEADING, read: readCseRoutine },
  { department: "EEE", heading: EEE_HEADING, read: readEeeRoutine },
];

const PDF_MAGIC = "%PDF-";
/** At most this many problems are listed when what was read can't be used. */
const MAX_PROBLEMS = 50;

/** A routine read from DIU's file, and which kind of file it was. */
export type ReadRoutine = RoutineImport & { kind: "pdf" | "xlsx" };

/**
 * The routine in a department's file, checked. `version`, when given, is the version
 * number to use instead of the one printed on it (or, for SWE's sheet, which has
 * none, in the file's `name`).
 */
export async function readRoutineFile(
  bytes: Uint8Array,
  { version, name }: { version?: string; name?: string } = {},
): Promise<ReadRoutine> {
  if (isZip(bytes)) {
    return { ...(await readSheet(bytes, { version, name })), kind: "xlsx" };
  }
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== PDF_MAGIC) {
    throw new AppError(
      422,
      "NOT_A_PDF",
      "This file isn't a routine PDF or Excel sheet",
    );
  }
  let pages;
  try {
    // A copy: the PDF reader may take over the buffer it's given.
    pages = await pdfText(bytes.slice());
  } catch {
    throw new AppError(
      422,
      "UNREADABLE_PDF",
      "This PDF can't be opened. Is it damaged or protected with a password?",
    );
  }
  const first = (pages[0] ?? []).map((t) => t.text).join(" ");
  const reader = READERS.find((r) => first.includes(r.heading));
  if (!reader) {
    throw new AppError(
      422,
      "UNKNOWN_ROUTINE_PDF",
      `This isn’t a routine PDF OurDIU can read: only ${READERS.map((r) => r.department).join(" and ")}’s, as DIU publishes them (and SWE’s Excel sheet).`,
    );
  }
  const read = reader.read(pages);
  if (version) read.file.version = version;
  return { ...checked(read, "PDF"), kind: "pdf" };
}

/** SWE's routine, from its Excel sheet. */
async function readSheet(
  bytes: Uint8Array,
  { version, name }: { version?: string; name?: string },
): Promise<RoutineImport> {
  let sheet: SheetCells;
  try {
    sheet = await sheetCells(bytes);
  } catch {
    throw new AppError(
      422,
      "UNREADABLE_PDF",
      "This file can't be opened. Is it an Excel sheet (.xlsx), not damaged?",
    );
  }
  const top = [...sheet.entries()]
    .filter(([row]) => row <= 5)
    .flatMap(([, cells]) => [...cells.values()]);
  if (!top.some((text) => text.includes(SWE_HEADING))) {
    throw new AppError(
      422,
      "UNKNOWN_ROUTINE_PDF",
      "This isn’t a routine sheet OurDIU can read: only SWE’s, as DIU publishes it.",
    );
  }
  const number = version || versionInName(name);
  if (!number) {
    throw new AppError(
      422,
      "NO_VERSION",
      "SWE’s sheet has no version number, nor its file name: enter it as Version.",
    );
  }
  return checked(readSweRoutine(sheet, number), "sheet");
}

/** What was read, if it makes a routine file; else 422 with the problems. */
function checked(read: RoutineImport, what: "PDF" | "sheet"): RoutineImport {
  const checked = routineFileSchema.safeParse(read.file);
  if (!checked.success) {
    const problems: RoutineFileProblem[] = checked.error.issues
      .slice(0, MAX_PROBLEMS)
      .map((issue) => ({
        path: routineFilePath(issue.path),
        message: issue.message,
      }));
    throw new AppError(
      422,
      "INVALID_ROUTINE_FILE",
      `The routine read from this ${what} can’t be used. Has its layout changed?`,
      problems,
    );
  }
  return { file: checked.data, notes: read.notes };
}
