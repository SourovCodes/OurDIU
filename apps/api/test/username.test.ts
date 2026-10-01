import type { ContributorDetail } from "@ourdiu/shared";
import { describe, expect, it } from "vitest";
import {
  api,
  jsonRequest,
  seedQuestion,
  seedSubmission,
  seedTaxonomy,
  seedUser,
  signIn,
  signInAdmin,
} from "./helpers";

const setUsername = (cookie: string, username: unknown) =>
  api("/api/v1/me/username", {
    ...jsonRequest("PUT", { username }),
    headers: { "content-type": "application/json", cookie },
  });

const sessionUsername = async (cookie: string) =>
  (
    await (
      await api("/api/auth/get-session", { headers: { cookie } })
    ).json<{
      user: { username: string };
    }>()
  ).user.username;

describe("usernames", () => {
  it("gives new users a generated one", async () => {
    const { cookie } = await signIn();
    expect(await sessionUsername(cookie)).toMatch(/^user_[0-9a-f]{6}$/);
  });

  it("lets users change theirs, in lowercase", async () => {
    const { cookie } = await signIn();
    const name = `Rafi.${crypto.randomUUID().slice(0, 8)}`;
    const res = await setUsername(cookie, `  ${name} `);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ username: name.toLowerCase() });
    expect(await sessionUsername(cookie)).toBe(name.toLowerCase());
  });

  it.each(["ab", "has space", "émile", "a/b", "x".repeat(51)])(
    "refuses %j",
    async (username) => {
      const { cookie } = await signIn();
      expect((await setUsername(cookie, username)).status).toBe(422);
    },
  );

  it("refuses someone else's, in any case", async () => {
    const other = await seedUser();
    const { cookie } = await signIn();
    const res = await setUsername(cookie, other.username!.toUpperCase());
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: { code: "USERNAME_TAKEN" },
    });
  });

  it("needs a session", async () => {
    const res = await api(
      "/api/v1/me/username",
      jsonRequest("PUT", { username: "someone" }),
    );
    expect(res.status).toBe(401);
  });

  it("finds a contributor by username, in any case, or by id", async () => {
    const contributor = await seedUser("Username Person");
    const t = await seedTaxonomy();
    const question = await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    });
    await seedSubmission(question.id, { uploaderId: contributor.id });

    for (const key of [
      contributor.username!,
      contributor.username!.toUpperCase(),
      contributor.id,
    ]) {
      const res = await api(`/api/v1/contributors/${encodeURIComponent(key)}`);
      expect(res.status).toBe(200);
      expect(await res.json<ContributorDetail>()).toMatchObject({
        id: contributor.id,
        username: contributor.username,
      });
    }
    expect((await api("/api/v1/contributors/nobody-here")).status).toBe(404);
  });

  describe("for admins", () => {
    const adminSet = (cookie: string, id: string, username: unknown) =>
      api(`/api/v1/admin/users/${encodeURIComponent(id)}/username`, {
        ...jsonRequest("PUT", { username }),
        headers: { "content-type": "application/json", cookie },
      });

    it("changes any user's username, with the same rules", async () => {
      const admin = await signInAdmin();
      const target = await seedUser();
      const name = `Fixed_${crypto.randomUUID().slice(0, 8)}`;

      const res = await adminSet(admin.cookie, target.id, name);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ username: name.toLowerCase() });
      const page = await api(`/api/v1/contributors/${name.toLowerCase()}`);
      // No published papers, so not a public contributor yet.
      expect(page.status).toBe(404);

      expect((await adminSet(admin.cookie, target.id, "a b")).status).toBe(422);
      const other = await seedUser();
      expect(
        (await adminSet(admin.cookie, target.id, other.username)).status,
      ).toBe(409);
      expect(
        (await adminSet(admin.cookie, "nobody", "someone_new")).status,
      ).toBe(404);
    });

    it("is for admins only", async () => {
      const member = await signIn();
      const target = await seedUser();
      expect((await adminSet(member.cookie, target.id, "hijack")).status).toBe(
        403,
      );
    });
  });
});
