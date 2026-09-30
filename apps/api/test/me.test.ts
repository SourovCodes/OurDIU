import type { Profile } from "@ourdiu/shared";
import { describe, expect, it } from "vitest";
import { api, jsonRequest, signIn } from "./helpers";

describe("GET /api/v1/me", () => {
  it("requires sign-in", async () => {
    const res = await api("/api/v1/me");
    expect(res.status).toBe(401);
  });

  it("returns your profile", async () => {
    const { cookie, id, email } = await signIn();

    const res = await api("/api/v1/me", { headers: { cookie } });

    expect(res.status).toBe(200);
    const profile = await res.json<Profile>();
    expect(profile).toMatchObject({
      id,
      email,
      name: "Test User",
      image: null,
      role: "user",
    });
    expect(profile.username).toMatch(/^user_/);
  });
});

describe("PUT /api/v1/me/username", () => {
  it("changes your username, in lowercase", async () => {
    const { cookie } = await signIn();
    const name = `Me_${crypto.randomUUID().slice(0, 8)}`;

    const res = await api(
      "/api/v1/me/username",
      jsonRequest("PUT", { username: name }, cookie),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ username: name.toLowerCase() });
  });

  it("refuses a taken or invalid username", async () => {
    const first = await signIn();
    const second = await signIn();
    const name = `taken_${crypto.randomUUID().slice(0, 8)}`;
    await api(
      "/api/v1/me/username",
      jsonRequest("PUT", { username: name }, first.cookie),
    );

    const taken = await api(
      "/api/v1/me/username",
      jsonRequest("PUT", { username: name }, second.cookie),
    );
    const invalid = await api(
      "/api/v1/me/username",
      jsonRequest("PUT", { username: "no spaces" }, second.cookie),
    );

    expect(taken.status).toBe(409);
    expect(invalid.status).toBe(422);
  });
});
