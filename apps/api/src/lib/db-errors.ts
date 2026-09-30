/**
 * Whether a failed query violated a SQLite constraint. Drizzle wraps the driver's
 * error, so the whole cause chain is checked.
 */
export function isConstraintError(
  err: unknown,
  kind: "UNIQUE" | "FOREIGN KEY",
): boolean {
  for (let e: unknown = err; e; e = (e as { cause?: unknown }).cause) {
    if (String(e).includes(`${kind} constraint failed`)) return true;
    if (typeof e !== "object") break;
  }
  return false;
}
