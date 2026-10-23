import {
  catalogKey,
  type CatalogMergeInput,
  type CatalogMergeResult,
  type MergedId,
  type MergedKind,
} from "@ourdiu/shared";
import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { SQLiteAsyncDialect } from "drizzle-orm/sqlite-core";
import type { Database } from "../db/client";
import {
  courses,
  departments,
  examTypes,
  mergedIds,
  questions,
  semesters,
} from "../db/schema";
import { AppError } from "../lib/errors";

/**
 * Admin merges: folding duplicate catalog entries ("Data Structure" and "Data
 * Structures") into the one an admin keeps. Everything filed under the others moves to
 * it, and they are deleted. Questions (exams) that become the same exam are combined,
 * so a merge never breaks the one-question-per-exam rule. Merging departments also
 * combines their courses that have the same name.
 *
 * A merge is planned from reads, then written as one D1 batch, which runs as a single
 * transaction. Counters (published counts per question, course and department) follow
 * by their triggers (migrations 0006, 0009, 0011); nothing here writes them.
 */

export type CatalogKind =
  "departments" | "courses" | "semesters" | "exam-types";

/** Questions columns a merge can change; department_id follows the course. */
type Column = "department_id" | "course_id" | "semester_id" | "exam_type_id";

type Combo = {
  departmentId: number;
  courseId: number;
  semesterId: number;
  examTypeId: number;
};

type AffectedQuestion = Combo & {
  id: number;
  viewCount: number;
  paperCount: number;
};

const COLUMN_OF: Record<keyof Combo, Column> = {
  departmentId: "department_id",
  courseId: "course_id",
  semesterId: "semester_id",
  examTypeId: "exam_type_id",
};

const MERGED_KIND: Record<CatalogKind, MergedKind> = {
  departments: "department",
  courses: "course",
  semesters: "semester",
  "exam-types": "exam_type",
};

const LABEL: Record<CatalogKind, string> = {
  departments: "Department",
  courses: "Course",
  semesters: "Semester",
  "exam-types": "Exam type",
};

// D1 allows 100 bound parameters per statement; question id lists grow with the
// catalog, so they're split.
const ID_CHUNK = 50;

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += ID_CHUNK) {
    out.push(items.slice(i, i + ID_CHUNK));
  }
  return out;
}

const idList = (ids: number[]) =>
  sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  );

const nowMs = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

const comboKey = (c: Combo) => `${c.courseId}|${c.semesterId}|${c.examTypeId}`;

/** How many of a question's columns a merge changes. */
const changes = (q: Combo, final: Combo) =>
  (Object.keys(COLUMN_OF) as (keyof Combo)[]).filter((k) => q[k] !== final[k])
    .length;

const dialect = new SQLiteAsyncDialect();

class Plan {
  readonly statements: D1PreparedStatement[] = [];

  constructor(private readonly db: Database) {
    // A department merge moves courses to the kept department, and the composite
    // foreign keys (course_id, department_id) on questions and submissions can't hold
    // half way through. Deferred, they are checked when the batch commits.
    this.run(sql.raw("PRAGMA defer_foreign_keys = on"));
  }

  // D1 statements rather than Drizzle's batch, which can't bind raw SQL parameters.
  run(query: SQL) {
    const { sql: text, params } = dialect.sqlToQuery(query);
    this.statements.push(this.db.$client.prepare(text).bind(...params));
  }

  /** Runs every statement as one transaction. */
  async commit() {
    await this.db.$client.batch(this.statements);
  }

  /** `build` for each chunk of `ids`. */
  each(ids: number[], build: (chunk: SQL) => SQL) {
    for (const chunk of chunks(ids)) this.run(build(idList(chunk)));
  }

  /**
   * Points `table.column` at `to` wherever it is one of `from`. For the proposal
   * columns of submissions and the AI's guesses in submission_analyses.
   */
  repoint(tables: string[], column: Column, from: number[], to: number) {
    for (const table of tables) {
      this.each(
        from,
        (ids) =>
          sql`update ${sql.identifier(table)} set ${sql.identifier(column)} = ${to} where ${sql.identifier(column)} in (${ids})`,
      );
    }
  }

  /**
   * Remembers where removed entries went, so their old pages redirect. Entries that
   * were merged into a removed one earlier now point at `to` as well.
   */
  remember(kind: MergedKind, from: number[], to: number) {
    this.each(
      from,
      (ids) =>
        sql`update merged_ids set new_id = ${to} where kind = ${kind} and new_id in (${ids})`,
    );
    for (const id of from) {
      this.run(
        sql`insert or replace into merged_ids (kind, old_id, new_id) values (${kind}, ${id}, ${to})`,
      );
    }
  }
}

/**
 * Moves every affected question to its final classification. Questions that end up
 * as the same exam are combined into one survivor: the one that changes least (one
 * already under the kept entry), then the most viewed, then the oldest. The others'
 * papers, saves and views move to it, and they are deleted.
 */
function reconcileQuestions(
  plan: Plan,
  affected: AffectedQuestion[],
  finalOf: (q: AffectedQuestion) => Combo,
) {
  const groups = new Map<string, { final: Combo; rows: AffectedQuestion[] }>();
  for (const q of affected) {
    const final = finalOf(q);
    const key = comboKey(final);
    const group = groups.get(key);
    if (group) group.rows.push(q);
    else groups.set(key, { final, rows: [q] });
  }

  let questionsMoved = 0;
  let questionsCombined = 0;
  let papersMoved = 0;
  const losers: number[] = [];
  // Survivors to update, by the column and value they get.
  const updates = new Map<
    string,
    { column: Column; value: number; ids: number[] }
  >();

  for (const { final, rows } of groups.values()) {
    rows.sort(
      (a, b) =>
        changes(a, final) - changes(b, final) ||
        b.viewCount - a.viewCount ||
        a.id - b.id,
    );
    const [survivor, ...others] = rows as [
      AffectedQuestion,
      ...AffectedQuestion[],
    ];
    for (const q of rows) {
      if (q !== survivor || changes(q, final) > 0) {
        questionsMoved++;
        papersMoved += q.paperCount;
      }
    }

    if (others.length > 0) {
      const ids = others.map((q) => q.id);
      losers.push(...ids);
      questionsCombined += ids.length;
      plan.each(
        ids,
        (list) =>
          sql`update submissions set question_id = ${survivor.id} where question_id in (${list})`,
      );
      // A user who saved both keeps one save; the rest go with the deleted question.
      plan.each(
        ids,
        (list) =>
          sql`update or ignore saved_questions set question_id = ${survivor.id} where question_id in (${list})`,
      );
      // Raw SQL, like page views themselves, so updated_at stays.
      plan.each(
        ids,
        (list) =>
          sql`update questions set view_count = view_count + (select coalesce(sum(view_count), 0) from questions where id in (${list})) where id = ${survivor.id}`,
      );
      // Today's views too ("Most viewed today" picks them up at the next refresh).
      plan.each(
        ids,
        (list) =>
          sql`insert into question_view_hours (question_id, hour, views) select ${survivor.id}, hour, views from question_view_hours where question_id in (${list}) on conflict (question_id, hour) do update set views = question_view_hours.views + excluded.views`,
      );
      plan.remember("question", ids, survivor.id);
    }

    for (const key of Object.keys(COLUMN_OF) as (keyof Combo)[]) {
      if (survivor[key] === final[key]) continue;
      const column = COLUMN_OF[key];
      const id = `${column}=${final[key]}`;
      const update = updates.get(id);
      if (update) update.ids.push(survivor.id);
      else updates.set(id, { column, value: final[key], ids: [survivor.id] });
    }
  }

  // Combined questions go first: their papers have moved, so their counters are 0,
  // and survivors can't collide with them on the unique exam key.
  plan.each(losers, (list) => sql`delete from questions where id in (${list})`);
  for (const { column, value, ids } of updates.values()) {
    plan.each(
      ids,
      (list) =>
        sql`update questions set ${sql.identifier(column)} = ${value}, updated_at = ${nowMs} where id in (${list})`,
    );
  }

  return { questionsMoved, questionsCombined, papersMoved };
}

const affectedQuestions = (db: Database, where: SQL | undefined) =>
  db
    .select({
      id: questions.id,
      departmentId: questions.departmentId,
      courseId: questions.courseId,
      semesterId: questions.semesterId,
      examTypeId: questions.examTypeId,
      viewCount: questions.viewCount,
      // Qualified by hand: Drizzle leaves `id` unqualified in a single-table select,
      // which would resolve inside the subquery.
      paperCount: sql
        .raw(
          `(select count(*) from "submissions" where "submissions"."question_id" = "questions"."id")`,
        )
        .mapWith(Number),
    })
    .from(questions)
    .where(where);

/** Papers awaiting review that propose one of `ids` as their `column`. */
async function countProposals(db: Database, column: Column, ids: number[]) {
  const row = await db.get<{ n: number }>(
    sql`select count(*) as n from submissions where ${sql.identifier(column)} in (${idList(ids)})`,
  );
  return Number(row?.n ?? 0);
}

const comboOf = (q: Combo): Combo => ({
  departmentId: q.departmentId,
  courseId: q.courseId,
  semesterId: q.semesterId,
  examTypeId: q.examTypeId,
});

/** Loads the entries by id, keep first; 404 if any is missing. */
async function loadEntries<T extends { id: number }>(
  kind: CatalogKind,
  rows: T[],
  keepId: number,
  removedIds: number[],
) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const keep = byId.get(keepId);
  const removed = removedIds.map((id) => byId.get(id));
  if (!keep || removed.some((r) => !r)) {
    throw new AppError(404, "NOT_FOUND", `${LABEL[kind]} not found`);
  }
  return { keep, removed: removed as T[] };
}

/**
 * Plans (and unless `dryRun`, runs) a merge of `mergeIds` into `keepId`. Returns what
 * moved, which the merge dialog shows before the admin confirms.
 */
export async function mergeCatalogEntries(
  db: Database,
  kind: CatalogKind,
  input: CatalogMergeInput,
): Promise<CatalogMergeResult> {
  const keepId = input.keepId;
  const removedIds = [...new Set(input.mergeIds)];
  const ids = [keepId, ...removedIds];
  const removedSet = new Set(removedIds);
  const plan = new Plan(db);

  let keep: { id: number; name: string };
  let counts: ReturnType<typeof reconcileQuestions>;
  let proposalsMoved: number;
  let extra: Pick<CatalogMergeResult, "coursesMoved" | "coursesCombined"> = {};

  if (kind === "departments") {
    const entries = await loadEntries(
      kind,
      await db
        .select({ id: departments.id, name: departments.name })
        .from(departments)
        .where(inArray(departments.id, ids)),
      keepId,
      removedIds,
    );
    keep = entries.keep;

    // Courses with the same name (as catalogKey compares them) become one: the kept
    // department's, else the one with the most papers, else the oldest.
    const involved = await db
      .select({
        id: courses.id,
        name: courses.name,
        departmentId: courses.departmentId,
        publishedCount: courses.publishedCount,
      })
      .from(courses)
      .where(inArray(courses.departmentId, ids));
    const byName = new Map<string, typeof involved>();
    for (const course of involved) {
      const key = catalogKey(course.name);
      byName.set(key, [...(byName.get(key) ?? []), course]);
    }
    const courseRemap = new Map<number, number>();
    const coursesCombined: { keep: string; removed: string[] }[] = [];
    let coursesMoved = 0;
    for (const group of byName.values()) {
      group.sort(
        (a, b) =>
          Number(b.departmentId === keepId) -
            Number(a.departmentId === keepId) ||
          b.publishedCount - a.publishedCount ||
          a.id - b.id,
      );
      const [survivor, ...others] = group as [
        (typeof involved)[number],
        ...typeof involved,
      ];
      if (survivor.departmentId !== keepId) coursesMoved++;
      if (others.length === 0) continue;
      for (const other of others) courseRemap.set(other.id, survivor.id);
      coursesCombined.push({
        keep: survivor.name,
        removed: others.map((c) => c.name),
      });
    }
    extra = { coursesMoved, coursesCombined };

    counts = reconcileQuestions(
      plan,
      await affectedQuestions(db, inArray(questions.departmentId, ids)),
      (q) => ({
        ...comboOf(q),
        departmentId: removedSet.has(q.departmentId) ? keepId : q.departmentId,
        courseId: courseRemap.get(q.courseId) ?? q.courseId,
      }),
    );
    proposalsMoved = await countProposals(db, "department_id", removedIds);

    const tables = ["submissions", "submission_analyses"];
    plan.repoint(tables, "department_id", removedIds, keepId);
    const bySurvivor = new Map<number, number[]>();
    for (const [from, to] of courseRemap) {
      bySurvivor.set(to, [...(bySurvivor.get(to) ?? []), from]);
    }
    for (const [to, from] of bySurvivor) {
      plan.repoint(tables, "course_id", from, to);
      plan.remember("course", from, to);
    }
    plan.each(
      [...courseRemap.keys()],
      (list) => sql`delete from courses where id in (${list})`,
    );
    plan.each(
      removedIds,
      (list) =>
        sql`update courses set department_id = ${keepId} where department_id in (${list})`,
    );
    plan.remember("department", removedIds, keepId);
    plan.each(
      removedIds,
      (list) => sql`delete from departments where id in (${list})`,
    );
  } else {
    // Courses, semesters and exam types: one column of the question changes.
    const config = {
      courses: { table: courses, key: "courseId", column: "course_id" },
      semesters: { table: semesters, key: "semesterId", column: "semester_id" },
      "exam-types": {
        table: examTypes,
        key: "examTypeId",
        column: "exam_type_id",
      },
    } as const satisfies Record<
      Exclude<CatalogKind, "departments">,
      { table: unknown; key: keyof Combo; column: Column }
    >;
    const { table, key, column } = config[kind];

    if (kind === "courses") {
      const entries = await loadEntries(
        kind,
        await db
          .select({
            id: courses.id,
            name: courses.name,
            departmentId: courses.departmentId,
          })
          .from(courses)
          .where(inArray(courses.id, ids)),
        keepId,
        removedIds,
      );
      if (
        entries.removed.some(
          (c) => c.departmentId !== entries.keep.departmentId,
        )
      ) {
        throw new AppError(
          422,
          "DIFFERENT_DEPARTMENTS",
          "Only courses of the same department can be merged. Merge the departments instead.",
        );
      }
      keep = entries.keep;
    } else {
      keep = (
        await loadEntries(
          kind,
          await db
            .select({ id: table.id, name: table.name })
            .from(table)
            .where(inArray(table.id, ids)),
          keepId,
          removedIds,
        )
      ).keep;
    }

    counts = reconcileQuestions(
      plan,
      await affectedQuestions(db, inArray(questions[key], ids)),
      (q) => ({
        ...comboOf(q),
        [key]: removedSet.has(q[key]) ? keepId : q[key],
      }),
    );
    proposalsMoved = await countProposals(db, column, removedIds);

    plan.repoint(
      ["submissions", "submission_analyses"],
      column,
      removedIds,
      keepId,
    );
    plan.remember(MERGED_KIND[kind], removedIds, keepId);
    plan.each(
      removedIds,
      (list) => sql`delete from ${table} where id in (${list})`,
    );
  }

  if (!input.dryRun) {
    await plan.commit();
  }

  return {
    keep: { id: keep.id, name: keep.name },
    removed: removedIds.length,
    ...counts,
    proposalsMoved,
    ...extra,
  };
}

/** Where an entry merged away went, or 404 if it was never merged. */
export async function findMergedId(
  db: Database,
  kind: MergedKind,
  id: number,
): Promise<MergedId> {
  const [row] = await db
    .select({ newId: mergedIds.newId })
    .from(mergedIds)
    .where(and(eq(mergedIds.kind, kind), eq(mergedIds.oldId, id)))
    .limit(1);
  if (!row) throw new AppError(404, "NOT_FOUND", "Not a merged entry");
  return { kind, id, mergedInto: row.newId };
}
