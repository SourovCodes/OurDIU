import { env, exports } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { createDb } from "../src/db/client";
import {
  courses,
  departments,
  examTypes,
  questions,
  semesters,
  submissions,
  type NewQuestionRow,
  type NewSubmissionRow,
  user,
} from "../src/db/schema";
import { authOptions } from "../src/lib/auth";

export const ORIGIN = "http://localhost:5173";

/** Inserts a user directly (no password), for tests that only need an uploader. */
export async function seedUser(name = "Test Contributor") {
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

/**
 * Inserts two departments with one course each, two semesters and two exam types.
 * Names get a random suffix so tests stay independent even when storage is shared.
 */
export async function seedTaxonomy() {
  const tag = crypto.randomUUID().slice(0, 8);
  const [cse, eee] = await db()
    .insert(departments)
    .values([
      { name: `Computer Science ${tag}`, shortName: `CSE-${tag}` },
      { name: `Electrical Engineering ${tag}`, shortName: `EEE-${tag}` },
    ])
    // As questions show a department (the row also has its trigger-kept count).
    .returning({
      id: departments.id,
      name: departments.name,
      shortName: departments.shortName,
    });
  const [algorithms, circuits] = await db()
    .insert(courses)
    .values([
      { name: `Algorithms ${tag}`, departmentId: cse!.id },
      { name: `Circuits ${tag}`, departmentId: eee!.id },
    ])
    .returning();
  const [sem1, sem2] = await db()
    .insert(semesters)
    .values([{ name: `1st Semester ${tag}` }, { name: `2nd Semester ${tag}` }])
    .returning();
  const [midterm, final] = await db()
    .insert(examTypes)
    .values([{ name: `Midterm ${tag}` }, { name: `Final ${tag}` }])
    .returning();

  return {
    cse: cse!,
    eee: eee!,
    algorithms: algorithms!,
    circuits: circuits!,
    sem1: sem1!,
    sem2: sem2!,
    midterm: midterm!,
    final: final!,
  };
}

export async function seedQuestion(values: NewQuestionRow) {
  const [row] = await db().insert(questions).values(values).returning();
  return row!;
}

export async function seedSubmission(
  questionId: number,
  overrides: Partial<NewSubmissionRow> = {},
) {
  const [row] = await db()
    .insert(submissions)
    .values({
      questionId,
      status: "published",
      fileKey: `submissions/${crypto.randomUUID()}.pdf`,
      fileSize: 1234,
      ...overrides,
    })
    .returning();
  return row!;
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

export function pdfFile(name = "paper.pdf") {
  return new File(["%PDF-1.7\n%test\n"], name, { type: "application/pdf" });
}
