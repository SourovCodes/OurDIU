import type { CatalogMergeResult, MergedId } from "@ourdiu/shared";
import { env } from "cloudflare:workers";
import { eq, inArray } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import {
  courses,
  departments,
  examTypes,
  questions,
  savedQuestions,
  semesters,
  submissionAnalyses,
  submissions,
} from "../src/db/schema";
import {
  api,
  db,
  jsonRequest,
  seedQuestion,
  seedSubmission,
  seedTaxonomy,
  seedUser,
  signIn,
  signInAdmin,
} from "./helpers";

let admin: Awaited<ReturnType<typeof signInAdmin>>;

beforeAll(async () => {
  admin = await signInAdmin();
});

const merge = (kind: string, body: unknown, cookie = admin.cookie) =>
  api(`/api/v1/admin/${kind}/merge`, jsonRequest("POST", body, cookie));

async function mergeOk(kind: string, body: unknown) {
  const res = await merge(kind, body);
  expect(res.status).toBe(200);
  return (await res.json()) as CatalogMergeResult;
}

/** Rows whose trigger-kept counters differ from a recount; 0 when the triggers work. */
async function countMismatches() {
  return env.DB.prepare(
    `SELECT
      (SELECT count(*) FROM questions q WHERE
        q.published_count <> (SELECT count(*) FROM submissions s WHERE s.question_id = q.id AND s.status = 'published')
        OR q.pending_review_count <> (SELECT count(*) FROM submissions s WHERE s.question_id = q.id AND s.status IN ('pending_review', 'changes_requested'))
        OR q.rejected_count <> (SELECT count(*) FROM submissions s WHERE s.question_id = q.id AND s.status = 'rejected')
        OR q.latest_published_at IS NOT (SELECT max(created_at) FROM submissions s WHERE s.question_id = q.id AND s.status = 'published')
      ) AS questions,
      (SELECT count(*) FROM departments d WHERE d.published_count <> (
        SELECT count(*) FROM submissions s JOIN questions q ON q.id = s.question_id
        WHERE q.department_id = d.id AND s.status = 'published')
      ) AS departments,
      (SELECT count(*) FROM courses c WHERE c.published_count <> (
        SELECT count(*) FROM submissions s JOIN questions q ON q.id = s.question_id
        WHERE q.course_id = c.id AND s.status = 'published')
      ) AS courses`,
  ).first();
}

const NO_MISMATCHES = { questions: 0, departments: 0, courses: 0 };

const findQuestion = (id: number) =>
  db().query.questions.findFirst({ where: eq(questions.id, id) });

async function addCourse(departmentId: number, name: string) {
  const [row] = await db()
    .insert(courses)
    .values({
      departmentId,
      name: `${name} ${crypto.randomUUID().slice(0, 6)}`,
    })
    .returning();
  return row!;
}

async function mergedInto(kind: string, id: number) {
  const res = await api(`/api/v1/merged/${kind}/${id}`);
  if (res.status === 404) return null;
  expect(res.status).toBe(200);
  return ((await res.json()) as MergedId).mergedInto;
}

describe("POST /api/v1/admin/courses/merge", () => {
  it("moves exams and papers, combining exams that become the same", async () => {
    const t = await seedTaxonomy();
    const duplicate = await addCourse(t.cse.id, "Algorithm");
    // The same exam under both names, and one only the duplicate has.
    const kept = await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.final.id,
    });
    const twin = await seedQuestion({
      departmentId: t.cse.id,
      courseId: duplicate.id,
      semesterId: t.sem1.id,
      examTypeId: t.final.id,
    });
    const onlyDuplicate = await seedQuestion({
      departmentId: t.cse.id,
      courseId: duplicate.id,
      semesterId: t.sem2.id,
      examTypeId: t.midterm.id,
    });
    await seedSubmission(kept.id);
    const moved = await seedSubmission(twin.id);
    const pending = await seedSubmission(twin.id, { status: "pending_review" });
    await seedSubmission(onlyDuplicate.id);
    await env.DB.prepare("UPDATE questions SET view_count = ? WHERE id = ?")
      .bind(7, kept.id)
      .run();
    await env.DB.prepare("UPDATE questions SET view_count = ? WHERE id = ?")
      .bind(5, twin.id)
      .run();

    // Two users saved the twin; one of them had saved the kept exam too.
    const both = await seedUser();
    const onlyTwin = await seedUser();
    await db()
      .insert(savedQuestions)
      .values([
        { userId: both.id, questionId: kept.id },
        { userId: both.id, questionId: twin.id },
        { userId: onlyTwin.id, questionId: twin.id },
      ]);

    // A paper proposing the duplicate course for a new semester, and the AI's guess.
    const proposal = await seedSubmission(onlyDuplicate.id, {
      status: "pending_review",
    });
    await db()
      .update(submissions)
      .set({
        questionId: null,
        departmentId: t.cse.id,
        courseId: duplicate.id,
        customSemesterName: "Fall 29",
        examTypeId: t.final.id,
      })
      .where(eq(submissions.id, proposal.id));
    await db().insert(submissionAnalyses).values({
      submissionId: moved.id,
      runId: crypto.randomUUID(),
      status: "completed",
      courseId: duplicate.id,
    });

    const body = { keepId: t.algorithms.id, mergeIds: [duplicate.id] };
    const preview = await mergeOk("courses", { ...body, dryRun: true });
    expect(preview).toEqual({
      keep: { id: t.algorithms.id, name: t.algorithms.name },
      removed: 1,
      questionsMoved: 2,
      questionsCombined: 1,
      papersMoved: 3,
      proposalsMoved: 1,
    });
    // A dry run writes nothing.
    expect(await findQuestion(twin.id)).toBeDefined();

    expect(await mergeOk("courses", body)).toEqual(preview);

    expect(
      await db().query.courses.findFirst({
        where: eq(courses.id, duplicate.id),
      }),
    ).toBeUndefined();
    expect(await findQuestion(twin.id)).toBeUndefined();
    const keptAfter = await findQuestion(kept.id);
    expect(keptAfter).toMatchObject({
      publishedCount: 2,
      pendingReviewCount: 1,
      viewCount: 12,
    });
    expect(await findQuestion(onlyDuplicate.id)).toMatchObject({
      courseId: t.algorithms.id,
    });
    const papers = await db()
      .select({ id: submissions.id, questionId: submissions.questionId })
      .from(submissions)
      .where(inArray(submissions.id, [moved.id, pending.id]));
    expect(papers.map((p) => p.questionId)).toEqual([kept.id, kept.id]);

    const saves = await db()
      .select()
      .from(savedQuestions)
      .where(inArray(savedQuestions.userId, [both.id, onlyTwin.id]));
    expect(saves.map((s) => [s.userId, s.questionId]).sort()).toEqual(
      [
        [both.id, kept.id],
        [onlyTwin.id, kept.id],
      ].sort(),
    );

    expect(
      await db().query.submissions.findFirst({
        where: eq(submissions.id, proposal.id),
      }),
    ).toMatchObject({ courseId: t.algorithms.id });
    expect(
      await db().query.submissionAnalyses.findFirst({
        where: eq(submissionAnalyses.submissionId, moved.id),
      }),
    ).toMatchObject({ courseId: t.algorithms.id });

    expect(
      await db().query.courses.findFirst({
        where: eq(courses.id, t.algorithms.id),
      }),
    ).toMatchObject({ publishedCount: 3 });
    expect(await countMismatches()).toEqual(NO_MISMATCHES);

    // Old links find their way.
    expect(await mergedInto("course", duplicate.id)).toBe(t.algorithms.id);
    expect(await mergedInto("question", twin.id)).toBe(kept.id);
    expect(await mergedInto("question", kept.id)).toBeNull();
  });

  it("keeps redirects flat when a kept course is merged again", async () => {
    const t = await seedTaxonomy();
    const a = await addCourse(t.cse.id, "Compiler");
    const b = await addCourse(t.cse.id, "Compilers");
    await mergeOk("courses", { keepId: b.id, mergeIds: [a.id] });
    await mergeOk("courses", { keepId: t.algorithms.id, mergeIds: [b.id] });
    expect(await mergedInto("course", a.id)).toBe(t.algorithms.id);
    expect(await mergedInto("course", b.id)).toBe(t.algorithms.id);
  });

  it("refuses courses of different departments", async () => {
    const t = await seedTaxonomy();
    const res = await merge("courses", {
      keepId: t.algorithms.id,
      mergeIds: [t.circuits.id],
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      error: { code: "DIFFERENT_DEPARTMENTS" },
    });
  });

  it("validates the ids", async () => {
    const t = await seedTaxonomy();
    expect(
      (
        await merge("courses", {
          keepId: t.algorithms.id,
          mergeIds: [t.algorithms.id],
        })
      ).status,
    ).toBe(422);
    expect(
      (await merge("courses", { keepId: t.algorithms.id, mergeIds: [] }))
        .status,
    ).toBe(422);
    expect(
      (
        await merge("courses", {
          keepId: t.algorithms.id,
          mergeIds: [999_999_999],
        })
      ).status,
    ).toBe(404);
  });

  it("is for admins only", async () => {
    const t = await seedTaxonomy();
    const body = { keepId: t.algorithms.id, mergeIds: [t.circuits.id] };
    expect(
      (await api("/api/v1/admin/courses/merge", jsonRequest("POST", body)))
        .status,
    ).toBe(401);
    const user = await signIn();
    expect((await merge("courses", body, user.cookie)).status).toBe(403);
  });
});

describe("POST /api/v1/admin/departments/merge", () => {
  it("moves courses and combines the ones with the same name", async () => {
    const t = await seedTaxonomy();
    const [dupe] = await db()
      .insert(departments)
      .values({
        name: `Computer Sci ${crypto.randomUUID().slice(0, 6)}`,
        shortName: `CS-${crypto.randomUUID().slice(0, 6)}`,
      })
      .returning();
    // Same course name up to case and an "&", and a course only the duplicate has.
    const [sameName, own] = await db()
      .insert(courses)
      .values([
        { departmentId: dupe!.id, name: t.algorithms.name.toLowerCase() },
        {
          departmentId: dupe!.id,
          name: `Networks ${crypto.randomUUID().slice(0, 6)}`,
        },
      ])
      .returning();

    const kept = await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.final.id,
    });
    const twin = await seedQuestion({
      departmentId: dupe!.id,
      courseId: sameName!.id,
      semesterId: t.sem1.id,
      examTypeId: t.final.id,
    });
    const other = await seedQuestion({
      departmentId: dupe!.id,
      courseId: own!.id,
      semesterId: t.sem2.id,
      examTypeId: t.midterm.id,
    });
    await seedSubmission(kept.id);
    await seedSubmission(twin.id);
    await seedSubmission(twin.id);
    await seedSubmission(other.id);
    const proposal = await seedSubmission(other.id, {
      status: "pending_review",
    });
    await db()
      .update(submissions)
      .set({
        questionId: null,
        departmentId: dupe!.id,
        courseId: sameName!.id,
        customSemesterName: "Fall 29",
        examTypeId: t.final.id,
      })
      .where(eq(submissions.id, proposal.id));

    const result = await mergeOk("departments", {
      keepId: t.cse.id,
      mergeIds: [dupe!.id],
    });
    expect(result).toEqual({
      keep: { id: t.cse.id, name: t.cse.name },
      removed: 1,
      questionsMoved: 2,
      questionsCombined: 1,
      papersMoved: 3,
      proposalsMoved: 1,
      coursesMoved: 1,
      coursesCombined: [{ keep: t.algorithms.name, removed: [sameName!.name] }],
    });

    expect(
      await db().query.departments.findFirst({
        where: eq(departments.id, dupe!.id),
      }),
    ).toBeUndefined();
    expect(
      await db().query.courses.findFirst({
        where: eq(courses.id, sameName!.id),
      }),
    ).toBeUndefined();
    expect(
      await db().query.courses.findFirst({ where: eq(courses.id, own!.id) }),
    ).toMatchObject({ departmentId: t.cse.id, publishedCount: 1 });
    expect(await findQuestion(kept.id)).toMatchObject({ publishedCount: 3 });
    expect(await findQuestion(other.id)).toMatchObject({
      departmentId: t.cse.id,
      courseId: own!.id,
    });
    expect(
      await db().query.submissions.findFirst({
        where: eq(submissions.id, proposal.id),
      }),
    ).toMatchObject({ departmentId: t.cse.id, courseId: t.algorithms.id });
    expect(
      await db().query.departments.findFirst({
        where: eq(departments.id, t.cse.id),
      }),
    ).toMatchObject({ publishedCount: 4 });
    expect(await countMismatches()).toEqual(NO_MISMATCHES);

    expect(await mergedInto("department", dupe!.id)).toBe(t.cse.id);
    expect(await mergedInto("course", sameName!.id)).toBe(t.algorithms.id);
    expect(await mergedInto("question", twin.id)).toBe(kept.id);
  });
});

describe("POST /api/v1/admin/semesters/merge and exam-types/merge", () => {
  it("merges semesters, combining exams", async () => {
    const t = await seedTaxonomy();
    const kept = await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.final.id,
    });
    const twin = await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem2.id,
      examTypeId: t.final.id,
    });
    await seedSubmission(twin.id);

    const result = await mergeOk("semesters", {
      keepId: t.sem1.id,
      mergeIds: [t.sem2.id],
    });
    expect(result).toMatchObject({
      questionsMoved: 1,
      questionsCombined: 1,
      papersMoved: 1,
    });
    expect(
      await db().query.semesters.findFirst({
        where: eq(semesters.id, t.sem2.id),
      }),
    ).toBeUndefined();
    expect(await findQuestion(kept.id)).toMatchObject({ publishedCount: 1 });
    expect(await countMismatches()).toEqual(NO_MISMATCHES);
  });

  it("merges exam types", async () => {
    const t = await seedTaxonomy();
    const q = await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    });
    const result = await mergeOk("exam-types", {
      keepId: t.final.id,
      mergeIds: [t.midterm.id],
    });
    expect(result).toMatchObject({ questionsMoved: 1, questionsCombined: 0 });
    expect(
      await db().query.examTypes.findFirst({
        where: eq(examTypes.id, t.midterm.id),
      }),
    ).toBeUndefined();
    expect(await findQuestion(q.id)).toMatchObject({ examTypeId: t.final.id });
  });
});

describe("GET /api/v1/merged/{kind}/{id}", () => {
  it("404s for entries never merged and 422s for unknown kinds", async () => {
    expect((await api("/api/v1/merged/course/999999999")).status).toBe(404);
    expect((await api("/api/v1/merged/teacher/1")).status).toBe(422);
  });
});
