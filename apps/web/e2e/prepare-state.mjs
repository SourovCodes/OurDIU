// Gives the e2e server a fresh local D1 and R2 of its own, so tests never depend on
// (or write to) `pnpm dev`'s data: wiped, migrated and seeded before the server starts.
// Usage: node e2e/prepare-state.mjs <state dir, relative to apps/web>
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const webDir = path.join(import.meta.dirname, "..");
const stateDir = path.resolve(webDir, process.argv[2]);

rmSync(stateDir, { recursive: true, force: true });
execFileSync(
  "pnpm",
  [
    "exec",
    "wrangler",
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--persist-to",
    stateDir,
  ],
  { cwd: webDir, stdio: ["ignore", "ignore", "inherit"] },
);
execFileSync(
  "node",
  [path.join(webDir, "../api/seeds/seed-local.mjs"), "--persist-to", stateDir],
  { stdio: "inherit" },
);
