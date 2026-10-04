import {
  routineFilePath,
  routineFileSchema,
  type RoutineFileProblem,
} from "@ourdiu/shared";
import { AppError } from "../../../lib/errors";
import { EEE_HEADING, readEeeRoutine } from "./eee";
import { pdfText } from "./text";
import type { RoutineImport } from "./types";

// Reading a routine from DIU's PDF. Each department lays its routine out its own way,
// so each has its own reader (only EEE's so far); a PDF no reader knows is refused,
// and its routine is uploaded as a JSON file instead.

const PDF_MAGIC = "%PDF-";
/** At most this many problems are listed when what was read can't be used. */
const MAX_PROBLEMS = 50;

/** The routine in a department's PDF, checked like an uploaded file. */
export async function readRoutinePdf(
  bytes: Uint8Array,
): Promise<RoutineImport> {
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== PDF_MAGIC) {
    throw new AppError(422, "NOT_A_PDF", "This file isn't a PDF");
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
  if (!first.includes(EEE_HEADING)) {
    throw new AppError(
      422,
      "UNKNOWN_ROUTINE_PDF",
      "OurDIU can read EEE’s routine PDF only, for now. Turn this routine into a JSON file and upload that.",
    );
  }
  const read = readEeeRoutine(pages);

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
      "The routine read from this PDF can’t be used. Has the PDF’s layout changed?",
      problems,
    );
  }
  return { file: checked.data, notes: read.notes };
}
