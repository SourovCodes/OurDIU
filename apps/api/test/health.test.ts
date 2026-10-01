import { describe, expect, it } from "vitest";
import committedSpec from "../openapi.json";
import { api } from "./helpers";

describe("system routes", () => {
  it("GET /api/v1/health", async () => {
    const res = await api("/api/v1/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("serves the OpenAPI document", async () => {
    const res = await api("/api/v1/openapi.json");
    expect(res.status).toBe(200);
    const doc = await res.json<{ paths: Record<string, unknown> }>();
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining([
        "/api/v1/health",
        "/api/v1/departments",
        "/api/v1/courses",
        "/api/v1/semesters",
        "/api/v1/exam-types",
        "/api/v1/questions",
        "/api/v1/questions/{id}",
        "/api/v1/submissions/{id}/file",
        "/api/v1/contributors",
        "/api/v1/contributors/{username}",
        "/api/v1/submissions",
        "/api/v1/me/submissions",
        "/api/v1/me/submissions/{id}",
        "/api/v1/me/submissions/{id}/file",
        "/api/v1/questions/{id}/views",
        "/api/v1/submissions/{id}/views",
        "/api/v1/submissions/{id}/vote",
        "/api/v1/submissions/{id}/reports",
        "/api/v1/me/questions/{id}/interactions",
        "/api/v1/me/avatar",
        "/api/v1/avatars/{id}",
      ]),
    );
  });

  // The mobile app's Dart client is generated from the committed copy.
  it("matches the committed openapi.json (run `pnpm openapi` to update)", async () => {
    const res = await api("/api/v1/openapi.json");
    expect(await res.json()).toEqual(committedSpec);
  });

  // `.nullable()` on a named schema marks the shared component nullable (or emits an
  // allOf that can't be null), and generated clients then get the types wrong. Named
  // schemas are made nullable with `nullableRef` instead.
  it("keeps nullability out of named components", async () => {
    const res = await api("/api/v1/openapi.json");
    const text = await res.text();
    const doc = JSON.parse(text) as {
      components: { schemas: Record<string, { type?: unknown }> };
    };
    const nullable = Object.entries(doc.components.schemas)
      .filter(([, schema]) => [schema.type].flat().includes("null"))
      .map(([name]) => name);
    expect(nullable).toEqual([]);
    expect(text).not.toMatch(/"allOf":\[\{"\$ref"/);
  });

  // Zod's export of `z.literal([1, -1])` keeps only the first value.
  it("lists both vote values", async () => {
    const res = await api("/api/v1/openapi.json");
    const doc = await res.json<{
      components: { schemas: Record<string, unknown> };
    }>();
    expect(doc.components.schemas.VoteValue).toEqual({
      type: "integer",
      enum: [1, -1],
    });
  });

  it("returns a structured 404 for unknown routes", async () => {
    const res = await api("/api/v1/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  });
});
