// Seeds the LOCAL D1 database and R2 bucket with sample data (never touches remote).
// Run from the repo root with `pnpm db:seed` after `pnpm db:migrate`. The e2e tests
// seed their own state with `--persist-to <dir>` (e2e/prepare-state.mjs).
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

// Wrangler runs where the Worker's config (and its local state) lives.
const webDir = path.join(import.meta.dirname, "../../web");
const sqlFile = path.join(import.meta.dirname, "dev.sql");
const samplePdf = path.join(import.meta.dirname, "sample.pdf");
const bucket = "ourdiu-files";

const persistAt = process.argv.indexOf("--persist-to");
const persist =
  persistAt === -1 ? [] : ["--persist-to", process.argv[persistAt + 1]];

function wrangler(args) {
  execFileSync("pnpm", ["exec", "wrangler", ...args, ...persist], {
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

// The live routine version's uploaded file.
wrangler([
  "r2",
  "object",
  "put",
  `${bucket}/routine/versions/seed-cse-4.1.json`,
  "--file",
  path.join(import.meta.dirname, "routine-cse-4.1.json"),
  "--content-type",
  "application/json",
  "--local",
]);

const size = statSync(samplePdf).size;
wrangler([
  "d1",
  "execute",
  "DB",
  "--local",
  "--command",
  `UPDATE submissions SET file_size = ${size} WHERE file_key LIKE 'submissions/seed-%'`,
]);

console.log(
  `Seeded local D1 and uploaded ${keys.size} sample PDFs and a routine file to R2.`,
);
