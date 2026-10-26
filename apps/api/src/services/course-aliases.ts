import { MAX_COURSE_ALIASES, normalizeAlias } from "@ourdiu/shared";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db/client";
import { courseAliases, courses, departments } from "../db/schema";
import { AppError } from "../lib/errors";
import { generateJson } from "../lib/gemini";
import type { Fetcher } from "../lib/pdf-processor";

// Courses' short names ("pps", "dsa", "discrete math"): the other names students
// search a course by, and the only ones search matches besides the course's name
// (@ourdiu/shared/search). An hourly cron fills them for courses it hasn't looked at
// yet (`fillCourseAliases`): their initials, worked out here, and the names the AI
// knows, many courses in one call. Admins add and remove them on the catalog page
// (`setCourseAliases`); merges keep the removed courses' names (services/merge.ts);
// a rename clears the generated ones, so the job fills them again (catalog.ts).

/**
 * Courses filled per run, one AI call an hour while any are left: inside the free
 * daily quota beside the text backfill (index.ts), and few enough for a reliable
 * answer.
 */
export const ALIASES_PER_RUN = 100;
/** At most this many short names per course from the AI. */
export const AI_ALIASES_PER_COURSE = 5;

// D1 allows 100 bound parameters per statement.
const ROWS_PER_INSERT = 30;
const IDS_PER_UPDATE = 90;

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

const responseJsonSchema = {
  type: "object",
  properties: {
    courses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "integer" },
          aliases: { type: "array", items: { type: "string" } },
        },
        required: ["id", "aliases"],
      },
    },
  },
  required: ["courses"],
};
const replySchema = z.object({
  courses: z.array(z.object({ id: z.number(), aliases: z.array(z.string()) })),
});

type PendingCourse = { id: number; name: string; department: string };

export function buildAliasPrompt(pending: PendingCourse[]): string {
  return `These are courses of Daffodil International University (DIU), Bangladesh, as named in its question bank, one per line: id, course name, department.

${pending.map((c) => `${c.id}\t${c.name}\t${c.department}`).join("\n")}

For each course, list the other names students commonly type when searching for it: well-known short forms and alternative names, like "dsa" for Data Structures, "algo" for Algorithms, "discrete math" for Discrete Mathematics, "calculus" for a Mathematics course that is calculus.
- Only names you're confident Bangladeshi university students really use for this course. Don't invent abbreviations, and don't guess course codes.
- Leave out the course name itself and its plain initials (the first letter of each word): they're added already.
- Lower-case, at most ${AI_ALIASES_PER_COURSE} per course, and an empty list when there's none.
- Answer every course, by its id.`;
}

/**
 * The AI's names for a course, cleaned: normalized, without the course's name, its
 * initials and repeats, capped.
 */
export function cleanAliases(name: string, aliases: string[]): string[] {
  const skip = new Set([name.toLowerCase(), initials(name)]);
  const kept: string[] = [];
  for (const raw of aliases) {
    const alias = normalizeAlias(raw);
    if (!alias || skip.has(alias) || kept.includes(alias)) continue;
    kept.push(alias);
    if (kept.length === AI_ALIASES_PER_COURSE) break;
  }
  return kept;
}

export type AliasEnv = {
  GEMINI_API_KEY?: string;
  GEMINI_TEXT_MODEL: string;
};

const SMALL_WORDS = new Set(["and", "of", "the", "in", "for", "to"]);
const NUMERAL = /^([ivx]+|\d+)$/;

/**
 * The first letters of a name's words, the way students shorten it:
 * "Programming and Problem Solving" is "pps", "Electrical Circuits I" is "ec".
 * Small words and numbers (Roman or not) are left out.
 */
export function initials(name: string): string {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !SMALL_WORDS.has(w) && !NUMERAL.test(w))
    .map((w) => w[0])
    .join("");
}

/** A course's initials as a short name, when they're two letters or more. */
export function initialsAlias(name: string): string | null {
  const short = initials(name);
  return short.length >= 2 ? short : null;
}

/** Inserts short names, skipping ones the course has (hidden ones included). */
function insertAliases(
  db: Database,
  rows: { courseId: number; alias: string; source: "ai" | "initials" }[],
) {
  return chunks(rows, ROWS_PER_INSERT).map((chunk) =>
    db.insert(courseAliases).values(chunk).onConflictDoNothing(),
  );
}

/**
 * Fills the short names of up to `limit` courses it hasn't looked at yet (oldest
 * first): their initials, then, in one AI call, the names students use for them; and
 * marks those courses as checked, also when the AI had none. Without an AI answer
 * (no key, a failed call) the initials are saved and the courses left for the next
 * run. Names already there, hidden ones (removed by an admin) included, aren't added
 * again.
 */
export async function fillCourseAliases(
  db: Database,
  env: AliasEnv,
  options: { limit?: number; fetch?: Fetcher; now?: Date } = {},
): Promise<{ checked: number; suggested: number }> {
  const pending = await db
    .select({
      id: courses.id,
      name: courses.name,
      department: departments.name,
    })
    .from(courses)
    .innerJoin(departments, eq(departments.id, courses.departmentId))
    .where(isNull(courses.aliasesCheckedAt))
    .orderBy(asc(courses.id))
    .limit(options.limit ?? ALIASES_PER_RUN);
  if (pending.length === 0) return { checked: 0, suggested: 0 };

  const initialsRows = pending.flatMap((c) => {
    const alias = initialsAlias(c.name);
    return alias
      ? [{ courseId: c.id, alias, source: "initials" as const }]
      : [];
  });
  const [firstInitials, ...moreInitials] = insertAliases(db, initialsRows);
  if (firstInitials) await db.batch([firstInitials, ...moreInitials]);

  if (!env.GEMINI_API_KEY) {
    console.error(
      "Course short names: GEMINI_API_KEY is missing, initials only",
    );
    return { checked: 0, suggested: 0 };
  }
  let reply: z.infer<typeof replySchema>;
  try {
    const { json } = await generateJson({
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_TEXT_MODEL,
      prompt: buildAliasPrompt(pending),
      responseJsonSchema,
      fetch: options.fetch,
    });
    reply = replySchema.parse(json);
  } catch (err) {
    console.error("Asking for course short names failed", err);
    return { checked: 0, suggested: 0 };
  }

  const byId = new Map(pending.map((c) => [c.id, c]));
  const rows: { courseId: number; alias: string; source: "ai" }[] = [];
  for (const answer of reply.courses) {
    const course = byId.get(answer.id);
    if (!course) continue;
    for (const alias of cleanAliases(course.name, answer.aliases)) {
      rows.push({ courseId: course.id, alias, source: "ai" });
    }
  }

  const ids = pending.map((c) => c.id);
  const now = options.now ?? new Date();
  const inserts = insertAliases(db, rows);
  const marks = chunks(ids, IDS_PER_UPDATE).map((chunk) =>
    db
      .update(courses)
      .set({ aliasesCheckedAt: now })
      .where(inArray(courses.id, chunk)),
  );
  const [first, ...rest] = [...marks, ...inserts];
  await db.batch([first!, ...rest]);
  return { checked: ids.length, suggested: rows.length };
}

/** A course's visible short names, A–Z. */
export async function courseAliasList(
  db: Database,
  courseId: number,
): Promise<string[]> {
  const rows = await db
    .select({ alias: courseAliases.alias })
    .from(courseAliases)
    .where(
      and(
        eq(courseAliases.courseId, courseId),
        eq(courseAliases.hidden, false),
      ),
    )
    .orderBy(asc(courseAliases.alias));
  return rows.map((r) => r.alias);
}

/**
 * Sets a course's short names to `aliases` (an admin's edit): new ones are added,
 * hidden ones shown again, and ones left out are hidden rather than deleted, so the
 * AI doesn't add them back.
 */
export async function setCourseAliases(
  db: Database,
  courseId: number,
  aliases: string[],
): Promise<void> {
  const wanted = [
    ...new Set(aliases.map(normalizeAlias).filter((a) => a !== null)),
  ];
  if (wanted.length > MAX_COURSE_ALIASES) {
    throw new AppError(
      422,
      "VALIDATION_ERROR",
      `A course can have at most ${MAX_COURSE_ALIASES} short names`,
    );
  }
  const hideOthers = db
    .update(courseAliases)
    .set({ hidden: true })
    .where(
      wanted.length > 0
        ? and(
            eq(courseAliases.courseId, courseId),
            sql`${courseAliases.alias} not in (${sql.join(
              wanted.map((a) => sql`${a}`),
              sql`, `,
            )})`,
          )
        : eq(courseAliases.courseId, courseId),
    );
  if (wanted.length === 0) {
    await hideOthers;
    return;
  }
  await db.batch([
    hideOthers,
    db
      .insert(courseAliases)
      .values(
        wanted.map((alias) => ({ courseId, alias, source: "admin" as const })),
      )
      .onConflictDoUpdate({
        target: [courseAliases.courseId, courseAliases.alias],
        set: { hidden: false },
      }),
  ]);
}
