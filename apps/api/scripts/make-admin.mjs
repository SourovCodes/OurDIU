// Grants the admin role to an existing account, e.g. the first admin in production.
// Usage: pnpm make-admin <email> [--remote]   (local D1 unless --remote is given)
import { execFileSync } from "node:child_process";
import path from "node:path";

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const email = args.find((arg) => !arg.startsWith("--"));
if (!email || !email.includes("@")) {
  console.error("Usage: pnpm make-admin <email> [--remote]");
  process.exit(1);
}

const quoted = `'${email.trim().toLowerCase().replaceAll("'", "''")}'`;
const output = execFileSync(
  "pnpm",
  [
    "exec",
    "wrangler",
    "d1",
    "execute",
    "DB",
    remote ? "--remote" : "--local",
    "--json",
    "--command",
    `UPDATE "user" SET role = 'admin' WHERE lower(email) = ${quoted} RETURNING id`,
  ],
  {
    // Where the Worker's config (and its local state) lives.
    cwd: path.join(import.meta.dirname, "../../web"),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  },
);

// Local D1 doesn't report `changes`, so count the returned rows instead.
const updated = JSON.parse(output)[0]?.results?.length ?? 0;
if (updated === 0) {
  console.error(`No account with the email ${email}. Sign up first.`);
  process.exit(1);
}
console.log(`${email} is now an admin (${remote ? "remote" : "local"} D1).`);
