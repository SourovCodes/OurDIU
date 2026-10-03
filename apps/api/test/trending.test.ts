import type { QuestionList, TrendingCourseList } from "@ourdiu/shared";
import { createScheduledController } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { asc, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import {
  questions,
  questionViewHours,
  semesters,
  submissions,
  trendingCourses,
  trendingQuestions,
} from "../src/db/schema";
import worker from "../src/index";
import { recordQuestionView } from "../src/services/engagement";
import {
  refreshTrending,
  TRENDING_HOURS,
  TRENDING_LIMIT,
} from "../src/services/trending";
import { api, db, seedQuestion, seedSubmission, seedTaxonomy } from "./helpers";

type Taxonomy = Awaited<ReturnType<typeof seedTaxonomy>>;

let t: Taxonomy;

beforeAll(async () => {
  t = await seedTaxonomy();
});

const currentHour = () => Math.floor(Date.now() / 3_600_000);

/** A question of its own (a new semester) with a published paper, or none. */
async function seedExam({
  departmentId = t.cse.id,
  courseId = t.algorithms.id,
  published = true,
} = {}) {
  const [semester] = await db()
    .insert(semesters)
    .values({ name: `Term ${crypto.randomUUID()}` })
    .returning();
  const question = await seedQuestion({
    departmentId,
    courseId,
    semesterId: semester!.id,
    examTypeId: t.final.id,
  });
  await seedSubmission(question.id, {
    status: published ? "published" : "pending_review",
  });
  return question;
}

async function setViews(
  questionId: number,
  byHoursAgo: Record<number, number>,
) {
  await db()
    .insert(questionViewHours)
    .values(
      Object.entries(byHoursAgo).map(([ago, views]) => ({
        questionId,
        hour: currentHour() - Number(ago),
        views,
      })),
    );
}

const trendingRows = () =>
  db()
    .select()
    .from(trendingQuestions)
    .orderBy(asc(trendingQuestions.questionId));

const listTrending = async (query = "") =>
  (await api(`/api/v1/questions?sort=trending${query}`)).json<QuestionList>();

/** Each test starts from an empty window. */
async function clearViews() {
  await db().delete(questionViewHours);
  await db().delete(trendingQuestions);
  await db().delete(trendingCourses);
}

describe("recordQuestionView", () => {
  it("adds to this hour's views as well as the all-time count", async () => {
    await clearViews();
    const question = await seedExam();
    expect(await recordQuestionView(db(), question.id)).toBe(true);
    expect(await recordQuestionView(db(), question.id)).toBe(true);

    const hours = await db()
      .select()
      .from(questionViewHours)
      .where(eq(questionViewHours.questionId, question.id));
    expect(hours).toHaveLength(1);
    expect(hours[0]!.views).toBe(2);
    expect([currentHour(), currentHour() - 1]).toContain(hours[0]!.hour);
    expect(
      (
        await db().query.questions.findFirst({
          where: eq(questions.id, question.id),
        })
      )?.viewCount,
    ).toBe(2);

    expect(await recordQuestionView(db(), 999_999)).toBe(false);
  });
});

describe("refreshTrending", () => {
  it("sums the last 24 hours, drops older views and unpublished questions", async () => {
    await clearViews();
    const busy = await seedExam();
    const quiet = await seedExam();
    const stale = await seedExam();
    const pending = await seedExam({ published: false });
    await setViews(busy.id, { 0: 5, 3: 4 });
    await setViews(quiet.id, { 1: 2, [TRENDING_HOURS - 1]: 1 });
    await setViews(stale.id, { [TRENDING_HOURS]: 50 });
    await setViews(pending.id, { 0: 99 });

    await refreshTrending(db());

    expect(await trendingRows()).toEqual(
      [
        { questionId: busy.id, views: 9 },
        { questionId: quiet.id, views: 3 },
      ].sort((a, b) => a.questionId - b.questionId),
    );
    // The bucket outside the window is gone; the ones inside stay.
    const left = await db()
      .select({ questionId: questionViewHours.questionId })
      .from(questionViewHours);
    expect(left.map((row) => row.questionId)).not.toContain(stale.id);
    expect(left.filter((row) => row.questionId === busy.id)).toHaveLength(2);

    // Rebuilt from scratch: a question no longer viewed leaves the list.
    await db()
      .delete(questionViewHours)
      .where(eq(questionViewHours.questionId, quiet.id));
    await refreshTrending(db());
    expect((await trendingRows()).map((row) => row.questionId)).toEqual([
      busy.id,
    ]);
  });

  it(`keeps the ${TRENDING_LIMIT} most viewed`, async () => {
    await clearViews();
    const exams = [];
    for (let i = 0; i < TRENDING_LIMIT + 2; i++) exams.push(await seedExam());
    // One by one: D1 binds at most 100 values per statement.
    for (const [i, exam] of exams.entries()) {
      await setViews(exam.id, { 0: i + 1 });
    }
    await refreshTrending(db());
    const rows = await trendingRows();
    expect(rows).toHaveLength(TRENDING_LIMIT);
    // The two least viewed didn't make it.
    expect(rows.map((row) => row.questionId)).not.toContain(exams[0]!.id);
    expect(rows.map((row) => row.questionId)).not.toContain(exams[1]!.id);
  });

  it("runs from the Worker's cron", async () => {
    await clearViews();
    const question = await seedExam();
    await setViews(question.id, { 0: 4 });
    await worker.scheduled(
      createScheduledController({ cron: "*/10 * * * *" }),
      env,
    );
    expect(await trendingRows()).toEqual([
      { questionId: question.id, views: 4 },
    ]);
  });

  it("follows a deleted question", async () => {
    await clearViews();
    const question = await seedExam();
    await setViews(question.id, { 0: 3 });
    await refreshTrending(db());
    await db()
      .delete(submissions)
      .where(eq(submissions.questionId, question.id));
    await db().delete(questions).where(eq(questions.id, question.id));
    expect(await trendingRows()).toEqual([]);
    expect(await db().select().from(questionViewHours)).toEqual([]);
  });
});

describe("GET /api/v1/questions?sort=trending", () => {
  it("lists today's most viewed first, with their views today", async () => {
    await clearViews();
    const first = await seedExam();
    const second = await seedExam({
      departmentId: t.eee.id,
      courseId: t.circuits.id,
    });
    const unviewed = await seedExam();
    await setViews(first.id, { 0: 7 });
    await setViews(second.id, { 2: 3 });
    await refreshTrending(db());

    const list = await listTrending();
    expect(list.total).toBe(2);
    expect(list.items.map((q) => [q.id, q.viewsToday])).toEqual([
      [first.id, 7],
      [second.id, 3],
    ]);

    // Filters still apply.
    const eee = await listTrending(`&departmentId=${t.eee.id}`);
    expect(eee.items.map((q) => q.id)).toEqual([second.id]);
    expect(eee.total).toBe(1);

    // Other lists say how many views today too, or null.
    const newest = await (
      await api(`/api/v1/questions?sort=newest&pageSize=100`)
    ).json<QuestionList>();
    const byId = new Map(newest.items.map((q) => [q.id, q.viewsToday]));
    expect(byId.get(first.id)).toBe(7);
    expect(byId.get(unviewed.id)).toBeNull();
  });
});

describe("GET /api/v1/courses/trending", () => {
  it("adds up each course's exams viewed today, most views first", async () => {
    await clearViews();
    const algorithmsFinal = await seedExam();
    const algorithmsMidterm = await seedExam();
    const circuits = await seedExam({
      departmentId: t.eee.id,
      courseId: t.circuits.id,
    });
    const pendingOnly = await seedExam({ published: false });
    await setViews(algorithmsFinal.id, { 0: 2 });
    await setViews(algorithmsMidterm.id, { 5: 3 });
    await setViews(circuits.id, { 1: 4, [TRENDING_HOURS]: 100 });
    // An exam without a published paper doesn't count for its course.
    await setViews(pendingOnly.id, { 0: 50 });
    await refreshTrending(db());

    const { items } = await (
      await api("/api/v1/courses/trending")
    ).json<TrendingCourseList>();
    expect(items).toEqual([
      {
        id: t.algorithms.id,
        name: t.algorithms.name,
        departmentId: t.cse.id,
        publishedCount: expect.any(Number),
        department: t.cse,
        viewsToday: 5,
      },
      {
        id: t.circuits.id,
        name: t.circuits.name,
        departmentId: t.eee.id,
        publishedCount: expect.any(Number),
        department: t.eee,
        viewsToday: 4,
      },
    ]);
  });

  it("is empty when nothing was viewed today", async () => {
    await clearViews();
    await refreshTrending(db());
    expect(
      (await (await api("/api/v1/courses/trending")).json<TrendingCourseList>())
        .items,
    ).toEqual([]);
  });
});
