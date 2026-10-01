import { env } from "cloudflare:workers";
import type { CreatedSubmission, QuestionDetail } from "@ourdiu/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DIU_EMAIL_REQUIRED } from "@ourdiu/shared/constants";
import { questions, semesters, submissions, user } from "../src/db/schema";
import {
  api,
  db,
  pdfFile,
  seedQuestion,
  seedTaxonomy,
  signIn,
} from "./helpers";

type Fields = Record<string, string | number>;

function upload(
  fields: Fields,
  cookie?: string,
  file: File | null = pdfFile(),
) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    body.append(key, String(value));
  }
  if (file) body.append("file", file);
  return api("/api/v1/submissions", {
    method: "POST",
    headers: cookie ? { cookie } : {},
    body,
  });
}

async function expectFieldError(res: Response, field: string) {
  expect(res.status).toBe(422);
  const body = await res.json<{
    error: { code: string; details: { path: string[] }[] };
  }>();
  expect(body.error.code).toBe("VALIDATION_ERROR");
  expect(body.error.details.map((issue) => issue.path[0])).toContain(field);
}

describe("POST /api/v1/submissions", () => {
  it("requires sign-in", async () => {
    const t = await seedTaxonomy();
    const res = await upload({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    });
    expect(res.status).toBe(401);
  });

  it("needs a DIU email, without storing anything", async () => {
    const t = await seedTaxonomy();
    const { cookie, id } = await signIn(
      `outsider-${crypto.randomUUID()}@gmail.com`,
    );

    const res = await upload(
      {
        departmentId: t.cse.id,
        courseId: t.algorithms.id,
        semesterId: t.sem1.id,
        examTypeId: t.midterm.id,
      },
      cookie,
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      error: { code: DIU_EMAIL_REQUIRED },
    });
    const rows = await db()
      .select()
      .from(submissions)
      .where(eq(submissions.uploaderId, id));
    expect(rows).toEqual([]);
  });

  it("lets admins contribute from any email", async () => {
    const t = await seedTaxonomy();
    const { cookie, id } = await signIn(
      `admin-${crypto.randomUUID()}@gmail.com`,
    );
    await db().update(user).set({ role: "admin" }).where(eq(user.id, id));

    const res = await upload(
      {
        departmentId: t.cse.id,
        courseId: t.algorithms.id,
        semesterId: t.sem1.id,
        examTypeId: t.midterm.id,
      },
      cookie,
    );

    expect(res.status).toBe(201);
  });

  it("files a PDF with existing values under one shared question, pending review", async () => {
    const t = await seedTaxonomy();
    const { cookie } = await signIn();
    const fields = {
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    };

    const first = await upload(fields, cookie);
    expect(first.status).toBe(201);
    const created = await first.json<CreatedSubmission>();
    expect(created).toMatchObject({
      status: "pending_review",
      questionId: expect.any(Number),
    });

    const row = await db().query.submissions.findFirst({
      columns: { fileKey: true },
      where: eq(submissions.id, created.id),
    });
    const object = await env.BUCKET.get(row!.fileKey);
    expect(new TextDecoder().decode(await object!.arrayBuffer())).toMatch(
      /^%PDF-/,
    );

    // The same combination reuses the question.
    const second = await (
      await upload(fields, cookie)
    ).json<CreatedSubmission>();
    expect(second.questionId).toBe(created.questionId);

    const detail = await (
      await api(`/api/v1/questions/${created.questionId}`)
    ).json<QuestionDetail>();
    expect(detail.submissionCounts).toEqual({
      published: 0,
      pendingReview: 2,
      rejected: 0,
    });
    expect(detail.submissions[0]?.uploader?.name).toBe("Test User");
  });

  it("stores an optional section and batch, treating blank fields as not given", async () => {
    const t = await seedTaxonomy();
    const { cookie } = await signIn();
    const fields = {
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.final.id,
    };

    const withDetails = await (
      await upload({ ...fields, section: " 5A ", batch: "61" }, cookie)
    ).json<CreatedSubmission>();
    const blank = await (
      await upload({ ...fields, section: "", batch: "  " }, cookie)
    ).json<CreatedSubmission>();

    const detail = await (
      await api(`/api/v1/questions/${withDetails.questionId}`)
    ).json<QuestionDetail>();
    const byId = (id: number) => detail.submissions.find((s) => s.id === id);
    expect(byId(withDetails.id)).toMatchObject({ section: "5A", batch: "61" });
    expect(byId(blank.id)).toMatchObject({ section: null, batch: null });

    await expectFieldError(
      await upload({ ...fields, section: "x".repeat(11) }, cookie),
      "section",
    );
  });

  it("reuses a question that already exists", async () => {
    const t = await seedTaxonomy();
    const { cookie } = await signIn();
    const question = await seedQuestion({
      departmentId: t.eee.id,
      courseId: t.circuits.id,
      semesterId: t.sem2.id,
      examTypeId: t.final.id,
    });

    const created = await (
      await upload(
        {
          departmentId: t.eee.id,
          courseId: t.circuits.id,
          semesterId: t.sem2.id,
          examTypeId: t.final.id,
        },
        cookie,
      )
    ).json<CreatedSubmission>();
    expect(created.questionId).toBe(question.id);
  });

  it("stores new department, course and semester names for review, without a question", async () => {
    const t = await seedTaxonomy();
    const { cookie } = await signIn();
    const res = await upload(
      {
        customDepartmentName: "Mechanical Engineering",
        customDepartmentShortName: "ME",
        customCourseName: "Thermodynamics",
        customSemesterName: "Short 17",
        examTypeId: t.final.id,
      },
      cookie,
    );
    expect(res.status).toBe(201);
    const created = await res.json<CreatedSubmission>();
    expect(created.questionId).toBeNull();

    const row = await db().query.submissions.findFirst({
      where: eq(submissions.id, created.id),
    });
    expect(row).toMatchObject({
      status: "pending_review",
      questionId: null,
      departmentId: null,
      customDepartmentName: "Mechanical Engineering",
      customDepartmentShortName: "ME",
      courseId: null,
      customCourseName: "Thermodynamics",
      semesterId: null,
      customSemesterName: "Short 17",
      examTypeId: t.final.id,
    });
  });

  it("rejects semester names outside the semester format", async () => {
    const t = await seedTaxonomy();
    const { cookie } = await signIn();
    const res = await upload(
      {
        departmentId: t.cse.id,
        courseId: t.algorithms.id,
        customSemesterName: "Summer Term",
        examTypeId: t.final.id,
      },
      cookie,
    );
    await expectFieldError(res, "customSemesterName");
  });

  it("accepts a new course in an existing department", async () => {
    const t = await seedTaxonomy();
    const { cookie } = await signIn();
    const created = await (
      await upload(
        {
          departmentId: t.cse.id,
          customCourseName: "Compilers",
          semesterId: t.sem2.id,
          examTypeId: t.midterm.id,
        },
        cookie,
      )
    ).json<CreatedSubmission>();
    expect(created.questionId).toBeNull();

    const row = await db().query.submissions.findFirst({
      where: eq(submissions.id, created.id),
    });
    expect(row).toMatchObject({
      departmentId: t.cse.id,
      customCourseName: "Compilers",
      semesterId: t.sem2.id,
    });
  });

  it("uses existing values when new names match them, ignoring case", async () => {
    const t = await seedTaxonomy();
    const { cookie } = await signIn();
    // Typed in another spelling of the semester format.
    await db()
      .insert(semesters)
      .values({ name: "Short 21" })
      .onConflictDoNothing();
    const semester = await db().query.semesters.findFirst({
      where: eq(semesters.name, "Short 21"),
    });
    const created = await (
      await upload(
        {
          customDepartmentName: t.cse.shortName.toLowerCase(),
          customDepartmentShortName: "IGNORED",
          customCourseName: t.algorithms.name.toUpperCase(),
          customSemesterName: "short 2021",
          examTypeId: t.midterm.id,
        },
        cookie,
      )
    ).json<CreatedSubmission>();

    expect(created.questionId).toEqual(expect.any(Number));
    const question = await db().query.questions.findFirst({
      where: eq(questions.id, created.questionId!),
    });
    expect(question).toMatchObject({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: semester!.id,
      examTypeId: t.midterm.id,
    });
  });

  it("only matches a course name within the chosen department", async () => {
    const t = await seedTaxonomy();
    const { cookie } = await signIn();
    const created = await (
      await upload(
        {
          departmentId: t.eee.id,
          customCourseName: t.algorithms.name, // exists, but in CSE
          semesterId: t.sem1.id,
          examTypeId: t.midterm.id,
        },
        cookie,
      )
    ).json<CreatedSubmission>();
    expect(created.questionId).toBeNull();

    const row = await db().query.submissions.findFirst({
      where: eq(submissions.id, created.id),
    });
    expect(row).toMatchObject({
      departmentId: t.eee.id,
      courseId: null,
      customCourseName: t.algorithms.name,
    });
  });

  describe("validation", () => {
    it("requires a department", async () => {
      const t = await seedTaxonomy();
      const { cookie } = await signIn();
      const res = await upload(
        { courseId: t.algorithms.id, semesterId: t.sem1.id, examTypeId: 1 },
        cookie,
      );
      await expectFieldError(res, "departmentId");
    });

    it("rejects both an existing and a new semester", async () => {
      const t = await seedTaxonomy();
      const { cookie } = await signIn();
      const res = await upload(
        {
          departmentId: t.cse.id,
          courseId: t.algorithms.id,
          semesterId: t.sem1.id,
          customSemesterName: "Fall 25",
          examTypeId: t.midterm.id,
        },
        cookie,
      );
      await expectFieldError(res, "semesterId");
    });

    it("rejects a course from another department", async () => {
      const t = await seedTaxonomy();
      const { cookie } = await signIn();
      const res = await upload(
        {
          departmentId: t.eee.id,
          courseId: t.algorithms.id,
          semesterId: t.sem1.id,
          examTypeId: t.midterm.id,
        },
        cookie,
      );
      await expectFieldError(res, "courseId");
    });

    it("rejects unknown ids", async () => {
      const t = await seedTaxonomy();
      const { cookie } = await signIn();
      const res = await upload(
        {
          departmentId: t.cse.id,
          courseId: t.algorithms.id,
          semesterId: 999999,
          examTypeId: t.midterm.id,
        },
        cookie,
      );
      await expectFieldError(res, "semesterId");
    });

    it("requires a file", async () => {
      const t = await seedTaxonomy();
      const { cookie } = await signIn();
      const res = await upload(
        {
          departmentId: t.cse.id,
          courseId: t.algorithms.id,
          semesterId: t.sem1.id,
          examTypeId: t.midterm.id,
        },
        cookie,
        null,
      );
      await expectFieldError(res, "file");
    });

    it("rejects files that are not PDFs", async () => {
      const t = await seedTaxonomy();
      const { cookie } = await signIn();
      const res = await upload(
        {
          departmentId: t.cse.id,
          courseId: t.algorithms.id,
          semesterId: t.sem1.id,
          examTypeId: t.midterm.id,
        },
        cookie,
        new File(["hello"], "paper.pdf", { type: "application/pdf" }),
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({
        error: { code: "INVALID_FILE" },
      });
    });
  });
});

describe("submissions table constraints", () => {
  const base = { status: "pending_review" as const, fileSize: 1 };
  const key = () => `submissions/${crypto.randomUUID()}.pdf`;

  it("rejects proposed values on a submission that already has a question", async () => {
    const t = await seedTaxonomy();
    const question = await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    });
    await expect(
      db()
        .insert(submissions)
        .values({
          ...base,
          fileKey: key(),
          questionId: question.id,
          customCourseName: "Sneaky",
        }),
    ).rejects.toThrow();
  });

  it("rejects a proposal whose course belongs to another department", async () => {
    const t = await seedTaxonomy();
    await expect(
      db()
        .insert(submissions)
        .values({
          ...base,
          fileKey: key(),
          departmentId: t.eee.id,
          courseId: t.algorithms.id,
          customSemesterName: "Summer",
          examTypeId: t.midterm.id,
        }),
    ).rejects.toThrow();
  });

  it("rejects a submission with neither a question nor a complete proposal", async () => {
    await expect(
      db()
        .insert(submissions)
        .values({ ...base, fileKey: key() }),
    ).rejects.toThrow();
  });
});
