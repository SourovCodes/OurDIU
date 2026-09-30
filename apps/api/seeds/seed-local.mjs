// Seeds the LOCAL D1 database with sample data (never touches remote).
// Run from the repo root with `pnpm db:seed` after `pnpm db:migrate`.
import { execFileSync } from "node:child_process";
import path from "node:path";

execFileSync(
  "pnpm",
  [
    "exec",
    "wrangler",
    "d1",
    "execute",
    "DB",
    "--local",
    "--file",
    path.join(import.meta.dirname, "dev.sql"),
  ],
  {
    // Where the Worker's config (and its local state) lives.
    cwd: path.join(import.meta.dirname, "../../web"),
    stdio: ["ignore", "ignore", "inherit"],
  },
);
console.log("Seeded local D1.");
