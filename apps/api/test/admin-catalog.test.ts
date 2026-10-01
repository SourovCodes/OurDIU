import type {
  AdminCatalog,
  AdminCourse,
  AdminDepartment,
  AdminExamType,
  AdminSemester,
} from "@ourdiu/shared";
import { beforeAll, describe, expect, it } from "vitest";
import {
  api,
  jsonRequest,
  seedQuestion,
  seedTaxonomy,
  signInAdmin,
  signIn,
} from "./helpers";

let admin: Awaited<ReturnType<typeof signInAdmin>>;

beforeAll(async () => {
  admin = await signInAdmin();
});

const call = (method: string, path: string, body?: unknown) =>
  api(
    `/api/v1/admin${path}`,
    body === undefined
      ? { method, headers: { cookie: admin.cookie } }
      : jsonRequest(method, body, admin.cookie),
  );

const unique = () => crypto.randomUUID().slice(0, 8);

describe("GET /api/v1/admin/catalog", () => {
  it("lists every kind of entry with its usage", async () => {
    const t = await seedTaxonomy();
    await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    });

    const res = await call("GET", "/catalog");
    expect(res.status).toBe(200);
    const catalog = await res.json<AdminCatalog>();
    expect(catalog.departments.find((d) => d.id === t.cse.id)).toMatchObject({
      courseCount: 1,
      questionCount: 1,
      submissionCount: 0,
    });
    expect(catalog.courses.find((c) => c.id === t.algorithms.id)).toMatchObject(
      { departmentId: t.cse.id, questionCount: 1 },
    );
    expect(catalog.semesters.find((s) => s.id === t.sem2.id)).toMatchObject({
      questionCount: 0,
    });
    expect(catalog.examTypes.find((e) => e.id === t.midterm.id)).toMatchObject({
      questionCount: 1,
    });
  });

  it("is only for admins", async () => {
    const member = await signIn();
    const res = await api(
      "/api/v1/admin/departments",
      jsonRequest("POST", { name: "Nope", shortName: "NO" }, member.cookie),
    );
    expect(res.status).toBe(403);
  });
});

describe("departments", () => {
  it("creates, renames and deletes a department, rejecting duplicates", async () => {
    const tag = unique();
    const created = await call("POST", "/departments", {
      name: ` Physics ${tag} `,
      shortName: `PHY-${tag}`,
    });
    expect(created.status).toBe(201);
    const department = await created.json<AdminDepartment>();
    expect(department).toMatchObject({
      name: `Physics ${tag}`,
      courseCount: 0,
      questionCount: 0,
    });

    const duplicate = await call("POST", "/departments", {
      name: `Other ${tag}`,
      shortName: `PHY-${tag}`,
    });
    expect(duplicate.status).toBe(409);

    const renamed = await call("PATCH", `/departments/${department.id}`, {
      name: `Applied Physics ${tag}`,
      shortName: `APHY-${tag}`,
    });
    expect(renamed.status).toBe(200);
    expect(await renamed.json<AdminDepartment>()).toMatchObject({
      name: `Applied Physics ${tag}`,
      shortName: `APHY-${tag}`,
    });

    expect((await call("DELETE", `/departments/${department.id}`)).status).toBe(
      204,
    );
    expect((await call("DELETE", `/departments/${department.id}`)).status).toBe(
      404,
    );
  });

  it("won't delete a department that still has courses", async () => {
    const t = await seedTaxonomy();
    const res = await call("DELETE", `/departments/${t.cse.id}`);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: {
        code: "IN_USE",
        message: "This department is used by 1 course and can't be deleted.",
      },
    });
  });

  it("validates input", async () => {
    const res = await call("POST", "/departments", { name: "X" });
    expect(res.status).toBe(422);
  });
});

describe("courses", () => {
  it("adds a course to a department and renames it", async () => {
    const t = await seedTaxonomy();
    const created = await call("POST", "/courses", {
      name: `Compilers ${unique()}`,
      departmentId: t.cse.id,
    });
    expect(created.status).toBe(201);
    const course = await created.json<AdminCourse>();
    expect(course.departmentId).toBe(t.cse.id);

    // Same name in the same department.
    const duplicate = await call("POST", "/courses", {
      name: course.name,
      departmentId: t.cse.id,
    });
    expect(duplicate.status).toBe(409);
    // Same name elsewhere is fine.
    const elsewhere = await call("POST", "/courses", {
      name: course.name,
      departmentId: t.eee.id,
    });
    expect(elsewhere.status).toBe(201);

    const unknownDepartment = await call("POST", "/courses", {
      name: "Orphan",
      departmentId: 999999,
    });
    expect(unknownDepartment.status).toBe(422);

    const renamed = await call("PATCH", `/courses/${course.id}`, {
      name: "Compiler Design",
    });
    expect(await renamed.json<AdminCourse>()).toMatchObject({
      id: course.id,
      name: "Compiler Design",
      departmentId: t.cse.id,
    });
  });

  it("won't delete a course with questions", async () => {
    const t = await seedTaxonomy();
    await seedQuestion({
      departmentId: t.eee.id,
      courseId: t.circuits.id,
      semesterId: t.sem1.id,
      examTypeId: t.final.id,
    });
    expect((await call("DELETE", `/courses/${t.circuits.id}`)).status).toBe(
      409,
    );
  });
});

describe("semesters and exam types", () => {
  it("creates, renames and deletes them", async () => {
    const entries = [
      { path: "/semesters", name: "Short 15", renamed: "Short 16" },
      {
        path: "/exam-types",
        name: `Entry ${unique()}`,
        renamed: `Entry ${unique()} renamed`,
      },
    ];
    for (const { path, name, renamed } of entries) {
      const created = await call("POST", path, { name });
      expect(created.status, path).toBe(201);
      const entry = await created.json<AdminSemester | AdminExamType>();
      expect(entry).toMatchObject({ name, questionCount: 0 });

      expect((await call("POST", path, { name })).status, path).toBe(409);

      const res = await call("PATCH", `${path}/${entry.id}`, {
        name: renamed,
      });
      expect(res.status, path).toBe(200);

      expect((await call("DELETE", `${path}/${entry.id}`)).status, path).toBe(
        204,
      );
    }
  });

  it("stores semesters as a term and a two-digit year", async () => {
    const created = await call("POST", "/semesters", { name: "short 2030" });
    expect(created.status).toBe(201);
    const entry = await created.json<AdminSemester>();
    expect(entry.name).toBe("Short 30");
    await call("DELETE", `/semesters/${entry.id}`);

    for (const name of ["Winter 25", "Fall 31", "3rd Semester"]) {
      expect((await call("POST", "/semesters", { name })).status, name).toBe(
        422,
      );
    }
  });
});
