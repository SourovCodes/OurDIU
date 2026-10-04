import type { RoutineFile } from "@ourdiu/shared";

/**
 * A routine read from a department's PDF: the file it makes, and what couldn't be
 * read or was read with a guess, for the admin to check.
 */
export type RoutineImport = { file: RoutineFile; notes: string[] };
