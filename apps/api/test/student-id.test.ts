import type { Profile } from "@ourdiu/shared";
import { describe, expect, it } from "vitest";
import { api, jsonRequest, signIn } from "./helpers";

const setStudentId = (cookie: string | undefined, studentId: unknown) =>
  api("/api/v1/me/student-id", jsonRequest("PUT", { studentId }, cookie));

const profile = async (cookie: string) =>
  (await api("/api/v1/me", { headers: { cookie } })).json<Profile>();

describe("PUT /api/v1/me/student-id", () => {
  it("requires sign-in", async () => {
    const res = await setStudentId(undefined, null);
    expect(res.status).toBe(401);
  });

  it("sets and clears your student ID", async () => {
    const { cookie } = await signIn();
    expect((await profile(cookie)).studentId).toBeNull();

    const res = await setStudentId(cookie, " 241-15-047 ");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ studentId: "241-15-047" });
    expect((await profile(cookie)).studentId).toBe("241-15-047");
    // With the session too, for the website's pages.
    const session = await (
      await api("/api/auth/get-session", { headers: { cookie } })
    ).json<{ user: { studentId: string } }>();
    expect(session.user.studentId).toBe("241-15-047");

    await setStudentId(cookie, "0242220005101255");
    expect((await profile(cookie)).studentId).toBe("0242220005101255");

    await setStudentId(cookie, null);
    expect((await profile(cookie)).studentId).toBeNull();
  });

  it("refuses other formats", async () => {
    const { cookie } = await signIn();
    for (const studentId of ["24115047", "241-15-04", "2.4231E+14", ""]) {
      const res = await setStudentId(cookie, studentId);
      expect(res.status).toBe(422);
    }
  });

  it("can't be set through Better Auth's update-user", async () => {
    const { cookie } = await signIn();
    await api(
      "/api/auth/update-user",
      jsonRequest("POST", { studentId: "241-15-047" }, cookie),
    );
    expect((await profile(cookie)).studentId).toBeNull();
  });
});

describe("sign-up", () => {
  it("takes the student ID out of the Google name", async () => {
    const { cookie } = await signIn(undefined, "Md Samir 262-35-490");
    expect(await profile(cookie)).toMatchObject({
      name: "Md Samir",
      studentId: "262-35-490",
    });
  });

  it("leaves other names alone", async () => {
    const { cookie } = await signIn(undefined, "Riti 787");
    expect(await profile(cookie)).toMatchObject({
      name: "Riti 787",
      studentId: null,
    });
  });
});
