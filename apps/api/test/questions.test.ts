import { env } from "cloudflare:workers";
import type { QuestionDetail, QuestionList } from "@ourdiu/shared";
import { describe, expect, it } from "vitest";
import { semesters } from "../src/db/schema";
import {
  api,
  db,
  seedQuestion,
  seedSubmission,
  seedTaxonomy,
  seedUser,
} from "./helpers";

describe("questions table constraints", () => {
  it("rejects a question whose department differs from its course's department", async () => {
    const { eee, algorithms, sem1, midterm } = await seedTaxonomy();
    await expect(
      seedQuestion({
        departmentId: eee.id, // algorithms belongs to CSE
        courseId: algorithms.id,
        semesterId: sem1.id,
        examTypeId: midterm.id,
      }),
    ).rejects.toThrow();
  });

  it("rejects duplicate course + semester + exam type combinations", async () => {
    const { cse, algorithms, sem1, midterm } = await seedTaxonomy();
    const values = {
      departmentId: cse.id,
      courseId: algorithms.id,
      semesterId: sem1.id,
      examTypeId: midterm.id,
    };
    await seedQuestion(values);
    await expect(seedQuestion(values)).rejects.toThrow();
  });
});

describe("GET /api/v1/questions", () => {
  it("lists only questions with a published paper and counts each status", async () => {
    const t = await seedTaxonomy();
    const base = { departmentId: t.cse.id, courseId: t.algorithms.id };
    const published = await seedQuestion({
      ...base,
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    });
    const pendingOnly = await seedQuestion({
      ...base,
      semesterId: t.sem2.id,
      examTypeId: t.final.id,
    });
    await seedQuestion({
      ...base,
      semesterId: t.sem1.id,
      examTypeId: t.final.id,
    }); // no submissions → not listed
    // pendingOnly has nothing to read yet → not listed either

    await seedSubmission(published.id);
    await seedSubmission(published.id);
    await seedSubmission(published.id, { status: "rejected" });
    await seedSubmission(pendingOnly.id, { status: "pending_review" });

    const res = await api(`/api/v1/questions?courseId=${t.algorithms.id}`);
    expect(res.status).toBe(200);
    const body = await res.json<QuestionList>();
    expect(body.total).toBe(1);
    expect(body.items).toEqual([
      {
        id: published.id,
        department: t.cse,
        course: { id: t.algorithms.id, name: t.algorithms.name },
        semester: t.sem1,
        examType: t.midterm,
        submissionCounts: { published: 2, pendingReview: 0, rejected: 1 },
        viewCount: 0,
      },
    ]);
  });

  it("groups a course's exam across semesters, newest semester first", async () => {
    const t = await seedTaxonomy();
    const tag = crypto.randomUUID().slice(0, 8);
    // Inserted out of order; ids alone would give the wrong order.
    const semesterRows = await db()
      .insert(semesters)
      .values(
        ["Fall 23", "Spring 25", "Summer 24", "Fall 24"].map((name) => ({
          name: `${tag} ${name}`,
        })),
      )
      .returning();
    const byName = (name: string) =>
      semesterRows.find((s) => s.name === `${tag} ${name}`)!;
    for (const examType of [t.final, t.midterm]) {
      for (const semester of semesterRows) {
        const question = await seedQuestion({
          departmentId: t.cse.id,
          courseId: t.algorithms.id,
          semesterId: semester.id,
          examTypeId: examType.id,
        });
        await seedSubmission(question.id);
      }
    }

    const body = await (
      await api(
        `/api/v1/questions?courseId=${t.algorithms.id}&pageSize=100&sort=az`,
      )
    ).json<QuestionList>();
    const order = ["Spring 25", "Fall 24", "Summer 24", "Fall 23"].map(
      (name) => byName(name).id,
    );
    // Exam types sort by name: "Final …" before "Midterm …".
    expect(body.items.map((q) => [q.examType.id, q.semester.id])).toEqual([
      ...order.map((id) => [t.final.id, id]),
      ...order.map((id) => [t.midterm.id, id]),
    ]);
  });

  it("filters by department, semester and exam type", async () => {
    const t = await seedTaxonomy();
    const csQuestion = await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    });
    const eeQuestion = await seedQuestion({
      departmentId: t.eee.id,
      courseId: t.circuits.id,
      semesterId: t.sem2.id,
      examTypeId: t.final.id,
    });
    await seedSubmission(csQuestion.id);
    await seedSubmission(eeQuestion.id);

    const ids = async (query: string) =>
      (
        await (await api(`/api/v1/questions?${query}`)).json<QuestionList>()
      ).items.map((q) => q.id);

    expect(await ids(`departmentId=${t.eee.id}`)).toEqual([eeQuestion.id]);
    expect(
      await ids(
        `departmentId=${t.cse.id}&semesterId=${t.sem1.id}&examTypeId=${t.midterm.id}`,
      ),
    ).toEqual([csQuestion.id]);
    expect(
      await ids(`departmentId=${t.cse.id}&courseId=${t.circuits.id}`),
    ).toEqual([]);
  });

  it("puts the newest papers or the most viewed first", async () => {
    const t = await seedTaxonomy();
    const older = await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
      viewCount: 50,
    });
    const newer = await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem2.id,
      examTypeId: t.midterm.id,
    });
    await seedSubmission(older.id, { createdAt: new Date(2026, 0, 1) });
    await seedSubmission(newer.id, { createdAt: new Date(2026, 5, 1) });

    const ids = async (sort: string) =>
      (
        await (
          await api(
            `/api/v1/questions?courseId=${t.algorithms.id}&sort=${sort}`,
          )
        ).json<QuestionList>()
      ).items.map((item) => item.id);
    expect(await ids("newest")).toEqual([newer.id, older.id]);
    expect(await ids("popular")).toEqual([older.id, newer.id]);
  });

  it("rejects invalid filters", async () => {
    const res = await api("/api/v1/questions?courseId=abc");
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  });
});

describe("GET /api/v1/questions/:id", () => {
  it("lists every submission's status, published first, without exposing file keys", async () => {
    const t = await seedTaxonomy();
    const question = await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    });
    const rejected = await seedSubmission(question.id, { status: "rejected" });
    const pending = await seedSubmission(question.id, {
      status: "pending_review",
    });
    const older = await seedSubmission(question.id, {
      createdAt: new Date("2024-01-01"),
    });
    const newer = await seedSubmission(question.id, {
      createdAt: new Date("2025-01-01"),
    });

    const res = await api(`/api/v1/questions/${question.id}`);
    expect(res.status).toBe(200);
    const body = await res.json<QuestionDetail>();
    expect(body.submissionCounts).toEqual({
      published: 2,
      pendingReview: 1,
      rejected: 1,
    });
    expect(body.submissions.map((s) => [s.id, s.status])).toEqual([
      [newer.id, "published"],
      [older.id, "published"],
      [pending.id, "pending_review"],
      [rejected.id, "rejected"],
    ]);
    expect(JSON.stringify(body)).not.toContain("fileKey");
  });

  it("includes each submission's uploader by public name only", async () => {
    const t = await seedTaxonomy();
    const question = await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    });
    const uploader = await seedUser("Ayesha Rahman");
    const withUploader = await seedSubmission(question.id, {
      uploaderId: uploader.id,
      createdAt: new Date("2025-01-01"),
    });
    const anonymous = await seedSubmission(question.id, {
      createdAt: new Date("2024-01-01"),
    });

    const body = await (
      await api(`/api/v1/questions/${question.id}`)
    ).json<QuestionDetail>();
    expect(body.submissions.map((s) => [s.id, s.uploader])).toEqual([
      [
        withUploader.id,
        {
          id: uploader.id,
          username: uploader.username,
          name: "Ayesha Rahman",
          image: null,
        },
      ],
      [anonymous.id, null],
    ]);
    expect(JSON.stringify(body)).not.toContain("@diu.edu.bd");
  });

  it("shows a question whose only submissions are pending review", async () => {
    const t = await seedTaxonomy();
    const question = await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    });
    await seedSubmission(question.id, { status: "pending_review" });

    const body = await (
      await api(`/api/v1/questions/${question.id}`)
    ).json<QuestionDetail>();
    expect(body.submissions).toHaveLength(1);
    expect(body.submissions[0]?.status).toBe("pending_review");
  });

  it("404s for unknown questions and questions without submissions", async () => {
    const t = await seedTaxonomy();
    const question = await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    });

    expect((await api(`/api/v1/questions/${question.id}`)).status).toBe(404);
    expect((await api("/api/v1/questions/999999")).status).toBe(404);
  });
});

describe("GET /api/v1/submissions/:id/file", () => {
  async function questionId() {
    const t = await seedTaxonomy();
    const question = await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    });
    return question.id;
  }

  it("streams a published submission's PDF from R2", async () => {
    const submission = await seedSubmission(await questionId());
    await env.BUCKET.put(submission.fileKey, "%PDF-1.7 hello", {
      httpMetadata: { contentType: "application/pdf" },
    });

    const res = await api(`/api/v1/submissions/${submission.id}/file`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(new TextDecoder().decode(await res.arrayBuffer())).toBe(
      "%PDF-1.7 hello",
    );
  });

  it.each(["pending_review", "rejected"] as const)(
    "never serves %s files",
    async (status) => {
      const submission = await seedSubmission(await questionId(), { status });
      await env.BUCKET.put(submission.fileKey, "%PDF-1.7 secret");

      expect(
        (await api(`/api/v1/submissions/${submission.id}/file`)).status,
      ).toBe(404);
    },
  );
});
