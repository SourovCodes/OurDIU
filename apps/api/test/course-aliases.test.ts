import type { AdminCourse, Taxonomy } from "@ourdiu/shared";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { courseAliases, courses } from "../src/db/schema";
import {
  cleanAliases,
  fillCourseAliases,
  initials,
  initialsAliases,
  type AliasEnv,
} from "../src/services/course-aliases";
import {
  api,
  db,
  jsonRequest,
  seedTaxonomy,
  signIn,
  signInAdmin,
} from "./helpers";

let admin: Awaited<ReturnType<typeof signInAdmin>>;

beforeAll(async () => {
  admin = await signInAdmin();
});

const aliasEnv = {
  GEMINI_API_KEY: "test-key",
  GEMINI_TEXT_MODEL: "gemini-test",
} satisfies AliasEnv;

/**
 * Answers Gemini with short names for the courses the prompt lists, from
 * `byName(name)`, and keeps the prompts.
 */
function fakeGemini(byName: (name: string) => string[], status = 200) {
  const prompts: string[] = [];
  const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const prompt = (
      JSON.parse(String(init?.body)) as {
        contents: { parts: { text?: string }[] }[];
      }
    ).contents[0]!.parts.at(-1)!.text!;
    prompts.push(prompt);
    if (status !== 200) return new Response("busy", { status });
    const listed = [...prompt.matchAll(/^(\d+)\t([^\t]+)\t/gm)].map((m) => ({
      id: Number(m[1]),
      aliases: byName(m[2]!),
    }));
    return Response.json({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify({ courses: listed }) }],
          },
          finishReason: "STOP",
        },
      ],
    });
  }) as typeof fetch;
  return { fetch: fetcher, prompts };
}

const aliasRows = (courseId: number) =>
  db()
    .select({
      alias: courseAliases.alias,
      source: courseAliases.source,
      hidden: courseAliases.hidden,
    })
    .from(courseAliases)
    .where(eq(courseAliases.courseId, courseId))
    .orderBy(courseAliases.alias);

const checkedAt = async (courseId: number) =>
  (
    await db().query.courses.findFirst({
      columns: { aliasesCheckedAt: true },
      where: eq(courses.id, courseId),
    })
  )?.aliasesCheckedAt ?? null;

const call = (method: string, path: string, body?: unknown, cookie?: string) =>
  api(
    `/api/v1/admin${path}`,
    jsonRequest(method, body ?? {}, cookie ?? admin.cookie),
  );

describe("initials", () => {
  it("are the first letters, without small words and numbers", () => {
    expect(initials("Programming and Problem Solving")).toBe("pps");
    expect(initials("Object Oriented Programming")).toBe("oop");
    expect(initials("Data Structures and Algorithms")).toBe("dsa");
    expect(initials("Introduction to Data Science")).toBe("ids");
    expect(initials("Electrical Circuits I")).toBe("ec");
    expect(initials("Physics-II")).toBe("p");
    expect(initials("Art of Living", true)).toBe("aol");
  });

  it("are stored without and with small words, two letters or more", () => {
    expect(initialsAliases("Art of Living")).toEqual(["al", "aol"]);
    expect(initialsAliases("Programming and Problem Solving")).toEqual([
      "pps",
      "paps",
    ]);
    expect(initialsAliases("Digital Logic Design")).toEqual(["dld"]);
    // One letter isn't worth a short name: the name starts with it.
    expect(initialsAliases("Physics II")).toEqual([]);
  });
});

describe("cleanAliases", () => {
  it("normalizes, and drops the name, its initials, repeats and extras", () => {
    expect(
      cleanAliases("Data Structures", [
        "DSA",
        " dsa ",
        "DS",
        "data structures",
        "Data  Str.",
        "x",
        "a",
        "b1",
        "c2",
        "d3",
        "e4",
      ]),
    ).toEqual(["dsa", "data str.", "b1", "c2", "d3"]);
    // Both kinds of initials are stored already.
    expect(cleanAliases("Art of Living", ["AOL", "al", "living"])).toEqual([
      "living",
    ]);
  });
});

describe("fillCourseAliases", () => {
  it("asks once for unchecked courses, saves their short names and marks them", async () => {
    const t = await seedTaxonomy();
    const { fetch, prompts } = fakeGemini((name) =>
      name.startsWith("Algorithms") ? ["Algo", "DSA"] : [],
    );

    const result = await fillCourseAliases(db(), aliasEnv, {
      limit: 1000,
      fetch,
    });

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain(`${t.algorithms.id}\t${t.algorithms.name}\t`);
    expect(result.checked).toBeGreaterThanOrEqual(2);
    expect(await aliasRows(t.algorithms.id)).toEqual(
      [
        { alias: "algo", source: "ai", hidden: false },
        { alias: "dsa", source: "ai", hidden: false },
        {
          alias: initialsAliases(t.algorithms.name)[0]!,
          source: "initials",
          hidden: false,
        },
      ].sort((a, b) => a.alias.localeCompare(b.alias)),
    );
    // Only its initials from the AI's empty answer, and checked, so not sent again.
    expect((await aliasRows(t.circuits.id)).map((r) => r.source)).toEqual([
      "initials",
    ]);
    expect(await checkedAt(t.circuits.id)).not.toBeNull();

    const again = fakeGemini(() => ["other"]);
    await fillCourseAliases(db(), aliasEnv, {
      limit: 1000,
      fetch: again.fetch,
    });
    expect(again.prompts.join()).not.toContain(t.algorithms.name);
  });

  it("saves initials but leaves courses unchecked without an AI answer", async () => {
    const t = await seedTaxonomy();
    const failing = fakeGemini(() => [], 503);
    expect(
      await fillCourseAliases(db(), aliasEnv, {
        limit: 1000,
        fetch: failing.fetch,
      }),
    ).toEqual({ checked: 0, suggested: 0 });
    expect(await checkedAt(t.algorithms.id)).toBeNull();
    expect(await aliasRows(t.algorithms.id)).toEqual([
      {
        alias: initialsAliases(t.algorithms.name)[0]!,
        source: "initials",
        hidden: false,
      },
    ]);

    const unused = fakeGemini(() => []);
    await fillCourseAliases(
      db(),
      { ...aliasEnv, GEMINI_API_KEY: "" },
      { fetch: unused.fetch },
    );
    expect(unused.prompts).toHaveLength(0);
  });

  it("doesn't bring back a short name an admin removed", async () => {
    const t = await seedTaxonomy();
    await db().insert(courseAliases).values({
      courseId: t.algorithms.id,
      alias: "algo",
      source: "ai",
      hidden: true,
    });
    const { fetch } = fakeGemini((name) =>
      name === t.algorithms.name ? ["algo"] : [],
    );
    await fillCourseAliases(db(), aliasEnv, { limit: 1000, fetch });
    expect(
      (await aliasRows(t.algorithms.id)).find((r) => r.alias === "algo"),
    ).toEqual({ alias: "algo", source: "ai", hidden: true });
  });
});

describe("PUT /api/v1/admin/courses/{id}/aliases", () => {
  it("sets a course's short names, hiding the ones left out", async () => {
    const t = await seedTaxonomy();
    let res = await call("PUT", `/courses/${t.algorithms.id}/aliases`, {
      aliases: ["  ALGO ", "dsa", "algo", "!"],
    });
    expect(res.status).toBe(200);
    expect((await res.json<AdminCourse>()).aliases).toEqual(["algo", "dsa"]);

    res = await call("PUT", `/courses/${t.algorithms.id}/aliases`, {
      aliases: ["dsa"],
    });
    expect((await res.json<AdminCourse>()).aliases).toEqual(["dsa"]);
    expect(await aliasRows(t.algorithms.id)).toEqual([
      { alias: "algo", source: "admin", hidden: true },
      { alias: "dsa", source: "admin", hidden: false },
    ]);

    // Shown again when an admin adds it back; none at all hides every one.
    res = await call("PUT", `/courses/${t.algorithms.id}/aliases`, {
      aliases: ["algo"],
    });
    expect((await res.json<AdminCourse>()).aliases).toEqual(["algo"]);
    res = await call("PUT", `/courses/${t.algorithms.id}/aliases`, {
      aliases: [],
    });
    expect((await res.json<AdminCourse>()).aliases).toEqual([]);
  });

  it("shows them in the taxonomy, without hidden ones", async () => {
    const t = await seedTaxonomy();
    await call("PUT", `/courses/${t.algorithms.id}/aliases`, {
      aliases: ["algo", "dsa"],
    });
    await call("PUT", `/courses/${t.algorithms.id}/aliases`, {
      aliases: ["dsa"],
    });
    const taxonomy = await (await api("/api/v1/taxonomy")).json<Taxonomy>();
    expect(
      taxonomy.courses.find((c) => c.id === t.algorithms.id)?.aliases,
    ).toEqual(["dsa"]);
    expect(
      taxonomy.courses.find((c) => c.id === t.circuits.id)?.aliases,
    ).toEqual([]);
  });

  it("refuses too many, unknown courses and non-admins", async () => {
    const t = await seedTaxonomy();
    const many = Array.from({ length: 11 }, (_, i) => `alias ${i}`);
    expect(
      (
        await call("PUT", `/courses/${t.algorithms.id}/aliases`, {
          aliases: many,
        })
      ).status,
    ).toBe(422);
    expect(
      (await call("PUT", "/courses/999999/aliases", { aliases: [] })).status,
    ).toBe(404);
    const member = await signIn();
    expect(
      (
        await call(
          "PUT",
          `/courses/${t.algorithms.id}/aliases`,
          { aliases: [] },
          member.cookie,
        )
      ).status,
    ).toBe(403);
  });
});

describe("renames and merges", () => {
  it("a rename clears the generated short names and has the job look again", async () => {
    const t = await seedTaxonomy();
    await db()
      .insert(courseAliases)
      .values([
        { courseId: t.algorithms.id, alias: "algo", source: "ai" },
        { courseId: t.algorithms.id, alias: "ae", source: "initials" },
        { courseId: t.algorithms.id, alias: "cse 221", source: "admin" },
      ]);
    await db()
      .update(courses)
      .set({ aliasesCheckedAt: new Date() })
      .where(eq(courses.id, t.algorithms.id));

    const res = await call("PATCH", `/courses/${t.algorithms.id}`, {
      name: `Algorithm Design ${t.cse.id}`,
    });
    expect((await res.json<AdminCourse>()).aliases).toEqual(["cse 221"]);
    expect(await checkedAt(t.algorithms.id)).toBeNull();
  });

  it("a merge keeps the removed course's name and short names", async () => {
    const t = await seedTaxonomy();
    const [other] = await db()
      .insert(courses)
      .values({ name: `Algorithm ${t.cse.id}`, departmentId: t.cse.id })
      .returning();
    await db()
      .insert(courseAliases)
      .values([
        { courseId: other!.id, alias: "algo", source: "ai" },
        { courseId: other!.id, alias: "gone", source: "admin", hidden: true },
      ]);

    const res = await api(
      "/api/v1/admin/courses/merge",
      jsonRequest(
        "POST",
        { keepId: t.algorithms.id, mergeIds: [other!.id] },
        admin.cookie,
      ),
    );
    expect(res.status).toBe(200);
    expect(await aliasRows(t.algorithms.id)).toEqual([
      { alias: "algo", source: "ai", hidden: false },
      {
        alias: `algorithm ${t.cse.id}`,
        source: "merge",
        hidden: false,
      },
      { alias: "gone", source: "admin", hidden: true },
    ]);
  });
});
