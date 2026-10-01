// Seeds the LOCAL D1 database and R2 bucket with sample data (never touches remote).
// Run from the repo root with `pnpm db:seed` after `pnpm db:migrate`.
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

// Wrangler runs where the Worker's config (and its local state) lives.
const webDir = path.join(import.meta.dirname, "../../web");
const sqlFile = path.join(import.meta.dirname, "dev.sql");
const samplePdf = path.join(import.meta.dirname, "sample.pdf");
const bucket = "questionbank-papers";

function wrangler(args) {
  execFileSync("pnpm", ["exec", "wrangler", ...args], {
    cwd: webDir,
    stdio: ["ignore", "ignore", "inherit"],
  });
}

wrangler(["d1", "execute", "DB", "--local", "--file", sqlFile]);

const keys = new Set(
  [
    ...readFileSync(sqlFile, "utf8").matchAll(/'(submissions\/[^']+\.pdf)'/g),
  ].map((match) => match[1]),
);
for (const key of keys) {
  wrangler([
    "r2",
    "object",
    "put",
    `${bucket}/${key}`,
    "--file",
    samplePdf,
    "--content-type",
    "application/pdf",
    "--local",
  ]);
}

const size = statSync(samplePdf).size;
wrangler([
  "d1",
  "execute",
  "DB",
  "--local",
  "--command",
  `UPDATE submissions SET file_size = ${size} WHERE file_key LIKE 'submissions/seed-%'`,
]);

console.log(`Seeded local D1 and uploaded ${keys.size} sample PDFs to R2.`);
