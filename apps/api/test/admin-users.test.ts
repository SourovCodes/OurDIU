import type { AdminUser, AdminUserList } from "@ourdiu/shared";
import { describe, expect, it } from "vitest";
import {
  api,
  jsonRequest,
  seedQuestion,
  seedSubmission,
  seedTaxonomy,
  seedUser,
  signInAdmin,
  signIn,
} from "./helpers";

describe("GET /api/v1/admin/users", () => {
  it("lists users newest first with their submission counts, searching name and email", async () => {
    const admin = await signInAdmin();
    const tag = crypto.randomUUID().slice(0, 8);
    const uploader = await seedUser(`Searchable ${tag}`);
    const t = await seedTaxonomy();
    const question = await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    });
    await seedSubmission(question.id, { uploaderId: uploader.id });
    await seedSubmission(question.id, {
      uploaderId: uploader.id,
      status: "rejected",
    });

    const res = await api(
      `/api/v1/admin/users?q=${encodeURIComponent(`searchable ${tag}`)}`,
      { headers: { cookie: admin.cookie } },
    );
    expect(res.status).toBe(200);
    const body = await res.json<AdminUserList>();
    expect(body.total).toBe(1);
    expect(body.items[0]).toMatchObject({
      id: uploader.id,
      email: uploader.email,
      role: "user",
      submissionCounts: { published: 1, pendingReview: 0, rejected: 1 },
    });

    // By email, and LIKE wildcards are matched literally.
    const byEmail = await api(
      `/api/v1/admin/users?q=${encodeURIComponent(uploader.email.slice(0, 12))}`,
      { headers: { cookie: admin.cookie } },
    );
    expect((await byEmail.json<AdminUserList>()).items[0]?.id).toBe(
      uploader.id,
    );
    const wildcard = await api("/api/v1/admin/users?q=%25%25%25", {
      headers: { cookie: admin.cookie },
    });
    expect((await wildcard.json<AdminUserList>()).total).toBe(0);

    const admins = await api("/api/v1/admin/users?role=admin&pageSize=100", {
      headers: { cookie: admin.cookie },
    });
    const adminList = await admins.json<AdminUserList>();
    expect(adminList.items.every((u) => u.role === "admin")).toBe(true);
    expect(adminList.items.some((u) => u.id === admin.id)).toBe(true);
  });
});

describe("PATCH /api/v1/admin/users/{id}", () => {
  it("grants and removes admin rights, but not on yourself", async () => {
    const admin = await signInAdmin();
    const member = await signIn();
    const setRole = (id: string, role: string) =>
      api(
        `/api/v1/admin/users/${id}`,
        jsonRequest("PATCH", { role }, admin.cookie),
      );

    const promoted = await setRole(member.id, "admin");
    expect(promoted.status).toBe(200);
    expect(await promoted.json<AdminUser>()).toMatchObject({ role: "admin" });
    // Applies to the member's existing session right away.
    expect(
      (await api("/api/v1/admin/stats", { headers: { cookie: member.cookie } }))
        .status,
    ).toBe(200);

    const demoted = await setRole(member.id, "user");
    expect(await demoted.json<AdminUser>()).toMatchObject({ role: "user" });

    expect((await setRole(admin.id, "user")).status).toBe(409);
    expect((await setRole("nope", "admin")).status).toBe(404);
    expect((await setRole(member.id, "owner")).status).toBe(422);
  });
});
