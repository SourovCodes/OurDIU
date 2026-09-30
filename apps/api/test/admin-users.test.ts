import type { AdminDepartment, AdminUserList } from "@ourdiu/shared";
import { describe, expect, it } from "vitest";
import { api, jsonRequest, seedUser, signIn, signInAdmin } from "./helpers";

describe("admin: users", () => {
  it("is for admins only", async () => {
    const { cookie } = await signIn();
    expect((await api("/api/v1/admin/users")).status).toBe(401);
    expect(
      (await api("/api/v1/admin/users", { headers: { cookie } })).status,
    ).toBe(403);
  });

  it("finds users by name and changes their role", async () => {
    const admin = await signInAdmin();
    const target = await seedUser(
      `Findable ${crypto.randomUUID().slice(0, 6)}`,
    );

    const list = await api(
      `/api/v1/admin/users?q=${encodeURIComponent(target.name)}`,
      { headers: { cookie: admin.cookie } },
    );
    expect(list.status).toBe(200);
    const body = await list.json<AdminUserList>();
    expect(body.items.map((u) => u.id)).toEqual([target.id]);

    const promoted = await api(
      `/api/v1/admin/users/${target.id}`,
      jsonRequest("PATCH", { role: "admin" }, admin.cookie),
    );
    expect(promoted.status).toBe(200);
    expect(await promoted.json()).toMatchObject({ role: "admin" });
  });

  it("won't let admins change their own role", async () => {
    const admin = await signInAdmin();
    const res = await api(
      `/api/v1/admin/users/${admin.id}`,
      jsonRequest("PATCH", { role: "user" }, admin.cookie),
    );
    expect(res.status).toBe(409);
  });
});

describe("admin: departments", () => {
  it("adds, renames and deletes a department", async () => {
    const admin = await signInAdmin();
    const shortName = `D${crypto
      .randomUUID()
      .replace(/[^a-f]/g, "")
      .slice(0, 5)}`;

    const created = await api(
      "/api/v1/admin/departments",
      jsonRequest("POST", { shortName, name: "Some Department" }, admin.cookie),
    );
    expect(created.status).toBe(201);
    const department = await created.json<AdminDepartment>();
    expect(department).toMatchObject({
      shortName: shortName.toUpperCase(),
    });

    const duplicate = await api(
      "/api/v1/admin/departments",
      jsonRequest("POST", { shortName, name: "Again" }, admin.cookie),
    );
    expect(duplicate.status).toBe(409);

    const renamed = await api(
      `/api/v1/admin/departments/${department.id}`,
      jsonRequest("PUT", { shortName, name: "Renamed" }, admin.cookie),
    );
    expect(await renamed.json()).toMatchObject({ name: "Renamed" });

    const deleted = await api(`/api/v1/admin/departments/${department.id}`, {
      method: "DELETE",
      headers: { cookie: admin.cookie },
    });
    expect(deleted.status).toBe(204);
  });

  it("refuses an invalid short name", async () => {
    const admin = await signInAdmin();
    const res = await api(
      "/api/v1/admin/departments",
      jsonRequest("POST", { shortName: "C S E", name: "Bad" }, admin.cookie),
    );
    expect(res.status).toBe(422);
  });
});
