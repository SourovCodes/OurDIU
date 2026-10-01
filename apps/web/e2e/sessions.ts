// Signed-in sessions for the e2e tests. Sign-in is Google-only, so tests can't log in
// through the UI. Instead, global setup writes a pool of sessions straight into the
// local D1 database, before any test runs, and each test claims its own.
//
// Writing to the database file while the dev server serves requests makes some of
// its queries fail ("Failed to get session"), so nothing is written once tests run.
import { createHmac, randomBytes } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const webDir = path.join(import.meta.dirname, "..");
const sessionsDir = path.join(import.meta.dirname, ".sessions");
const poolFile = path.join(sessionsDir, "pool.json");
const claimsDir = path.join(sessionsDir, "claims");

/** Enough for every test in both projects, including CI's two retries. */
const POOL_SIZE = { user: 60, reader: 10, admin: 40 };

/** The admin account created by `pnpm db:seed`. */
const SEED_ADMIN_ID = "seed-user-admin";

export type SessionKind = keyof typeof POOL_SIZE;
export type TestSession = { userId: string; email: string; cookie: string };
type Pool = Record<SessionKind, TestSession[]>;

/** The API's session-cookie secret, from `apps/web/.dev.vars` (CI writes a random one). */
function authSecret() {
  const vars = readFileSync(path.join(webDir, ".dev.vars"), "utf8");
  const secret = /^BETTER_AUTH_SECRET=(.*)$/m
    .exec(vars)?.[1]
    ?.trim()
    .replace(/^"(.*)"$/, "$1");
  if (!secret)
    throw new Error("BETTER_AUTH_SECRET missing from apps/web/.dev.vars");
  return secret;
}

function localDb() {
  const dir = path.join(
    webDir,
    ".wrangler/state/v3/d1/miniflare-D1DatabaseObject",
  );
  const files = readdirSync(dir).filter(
    (name) => name.endsWith(".sqlite") && name !== "metadata.sqlite",
  );
  if (files.length === 0)
    throw new Error("No local D1 database: run `pnpm db:migrate`");
  // A database_id change in wrangler.jsonc leaves the old database's file behind,
  // and sessions written there wouldn't be seen by the dev server.
  if (files.length > 1)
    throw new Error(
      `${files.length} local D1 databases in ${dir}: delete the folder, then run \`pnpm db:migrate && pnpm db:seed\``,
    );
  const file = files[0]!;
  const db = new DatabaseSync(path.join(dir, file));
  db.exec("PRAGMA busy_timeout = 10000");
  return db;
}

/**
 * Replaces the previous run's pool: fresh users (`e2e-pool-…`, which `pnpm db:seed`
 * also cleans up) and sessions for the seed admin. Members are on a DIU address, so
 * they can contribute; readers aren't.
 */
export function createSessionPool() {
  const secret = authSecret();
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  // Signed like Better Auth (better-call): `token.base64(HMAC-SHA256(token))`, URI-encoded.
  const cookieFor = (token: string) =>
    encodeURIComponent(
      `${token}.${createHmac("sha256", secret).update(token).digest("base64")}`,
    );

  const db = localDb();
  const pool: Pool = { user: [], reader: [], admin: [] };
  try {
    db.exec("BEGIN");
    db.exec(`DELETE FROM "user" WHERE id LIKE 'e2e-pool-%'`);
    db.exec(`DELETE FROM session WHERE id LIKE 'e2e-pool-%'`);
    const insertUser = db.prepare(
      `INSERT INTO "user" (id, name, email, email_verified, username) VALUES (?, 'E2E User', ?, 1, ?)`,
    );
    const insertSession = db.prepare(
      "INSERT INTO session (id, token, user_id, expires_at) VALUES (?, ?, ?, ?)",
    );
    for (const kind of ["user", "reader", "admin"] as const) {
      for (let i = 0; i < POOL_SIZE[kind]; i++) {
        const userId =
          kind === "admin"
            ? SEED_ADMIN_ID
            : `e2e-pool-${randomBytes(6).toString("hex")}`;
        const email =
          kind === "admin"
            ? "admin@seed.local"
            : kind === "reader"
              ? `${userId}@example.com`
              : `${userId}@s.diu.edu.bd`;
        if (kind !== "admin") insertUser.run(userId, email, userId);
        const token = randomBytes(24).toString("base64url");
        insertSession.run(`e2e-pool-${kind}-${i}`, token, userId, expiresAt);
        pool[kind].push({ userId, email, cookie: cookieFor(token) });
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  } finally {
    db.close();
  }

  rmSync(sessionsDir, { recursive: true, force: true });
  mkdirSync(claimsDir, { recursive: true });
  writeFileSync(poolFile, JSON.stringify(pool));
}

/** Takes an unused session from the pool. Safe across parallel workers. */
export function claimSession(kind: SessionKind): TestSession {
  const pool = JSON.parse(readFileSync(poolFile, "utf8")) as Pool;
  for (const [i, session] of pool[kind].entries()) {
    try {
      // mkdir is atomic: only one worker gets each session.
      mkdirSync(path.join(claimsDir, `${kind}-${i}`));
      return session;
    } catch {
      // Claimed already.
    }
  }
  throw new Error(`All ${pool[kind].length} ${kind} sessions are used up`);
}
