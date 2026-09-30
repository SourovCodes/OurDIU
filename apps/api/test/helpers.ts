import { env, exports } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { createDb } from "../src/db/client";
import { departments, user } from "../src/db/schema";
import { authOptions } from "../src/lib/auth";

export const ORIGIN = "http://localhost:5173";

/** Inserts a user directly (no session), e.g. an existing account. */
export async function seedUser(name = "Test User") {
  const id = crypto.randomUUID();
  const [row] = await createDb(env.DB)
    .insert(user)
    .values({
      id,
      name,
      email: `${id}@diu.edu.bd`,
      username: `u_${id.slice(0, 8)}`,
    })
    .returning();
  return row!;
}

export function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("origin")) headers.set("origin", ORIGIN);
  return exports.default.fetch(
    new Request(`${ORIGIN}${path}`, { ...init, headers }),
  );
}

export const db = () => createDb(env.DB);

/**
 * Test-only auth instance: the app's own options plus Better Auth's `testUtils`,
 * which creates sessions directly. Sign-in is Google-only, so there is no endpoint
 * a test could log in through.
 */
function testAuth() {
  const options = authOptions(env, db());
  return betterAuth({ ...options, plugins: [...options.plugins, testUtils()] });
}

/** Creates a fresh user and returns a Cookie header value for authenticated requests. */
export async function signIn(email = `user-${crypto.randomUUID()}@diu.edu.bd`) {
  const { test } = await testAuth().$context;
  const saved = await test.saveUser(
    test.createUser({ name: "Test User", email }),
  );
  const { headers } = await test.login({ userId: saved.id });
  return { email, cookie: headers.get("cookie")!, id: saved.id };
}

/** Signs in a fresh user and makes them an admin. */
export async function signInAdmin() {
  const admin = await signIn();
  await db().update(user).set({ role: "admin" }).where(eq(user.id, admin.id));
  return admin;
}

/** Request init for a JSON body, optionally signed in. */
export function jsonRequest(
  method: string,
  body: unknown,
  cookie?: string,
): RequestInit {
  return {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  };
}

/** A department with a random short name, so tests sharing storage stay apart. */
export async function seedDepartment(
  name = "Computer Science and Engineering",
) {
  const shortName = `T${crypto
    .randomUUID()
    .replace(/[^a-f]/g, "")
    .slice(0, 6)}`
    .toUpperCase()
    .padEnd(4, "X");
  const [row] = await db()
    .insert(departments)
    .values({ name, shortName })
    .returning();
  return row!;
}
