import type { AndroidApp } from "@ourdiu/shared";
import { describe, expect, it } from "vitest";
import { api } from "./helpers";

describe("GET /api/v1/app/android", () => {
  it("says which app version is the oldest that still works, to anyone", async () => {
    const res = await api("/api/v1/app/android");
    expect(res.status).toBe(200);
    const body = await res.json<AndroidApp>();
    expect(body.minVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
