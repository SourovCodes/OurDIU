// Moves student IDs out of users' names into their `student_id` (`splitStudentId`):
// many DIU Google accounts are named like "Md. Samir 262-35-490". New users get this
// at sign-up; this is for the accounts made before. Users who already have a student
// ID are skipped.
// Usage: pnpm student-ids-from-names [--remote] [--apply]
//   Lists the changes; --apply makes them (local D1 unless --remote is given).
import { splitStudentId } from "@ourdiu/shared/constants";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const apply = args.includes("--apply");

function d1(...command: string[]) {
  return execFileSync(
    "pnpm",
    [
      "exec",
      "wrangler",
      "d1",
      "execute",
      "DB",
      remote ? "--remote" : "--local",
      ...command,
    ],
    {
      // Where the Worker's config (and its local state) lives.
      cwd: path.join(import.meta.dirname, "../../web"),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
}

const users = (
  JSON.parse(
    d1(
      "--json",
      "--command",
      `SELECT id, name FROM "user" WHERE student_id IS NULL`,
    ),
  ) as { results: { id: string; name: string }[] }[]
)[0]!.results;

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const updates = users.flatMap(({ id, name }) => {
  const split = splitStudentId(name);
  if (!split.studentId) return [];
  console.log(`${name}  →  ${split.name}  |  ${split.studentId}`);
  // Guarded, in case the user changed their name in the meantime.
  return [
    `UPDATE "user" SET name = ${quote(split.name)}, student_id = ${quote(split.studentId)} ` +
      `WHERE id = ${quote(id)} AND name = ${quote(name)} AND student_id IS NULL;`,
  ];
});

const where = remote ? "remote" : "local";
if (updates.length === 0) {
  console.log(`No names with a student ID (${where} D1).`);
} else if (!apply) {
  console.log(
    `\n${updates.length} of ${users.length} names have a student ID (${where} D1). Run again with --apply to move them.`,
  );
} else {
  const file = path.join(
    mkdtempSync(path.join(tmpdir(), "student-ids-")),
    "update.sql",
  );
  writeFileSync(file, updates.join("\n"));
  d1("--yes", "--file", file);
  console.log(
    `\nMoved ${updates.length} student IDs out of names (${where} D1).`,
  );
}
