import type { Sitemap } from "@ourdiu/shared";
import { describe, expect, it } from "vitest";
import {
  api,
  seedQuestion,
  seedSubmission,
  seedTaxonomy,
  seedUser,
} from "./helpers";

describe("GET /api/v1/sitemap", () => {
  it("lists only questions and contributors with published papers", async () => {
    const t = await seedTaxonomy();
    const base = { departmentId: t.cse.id, courseId: t.algorithms.id };
    const published = await seedQuestion({
      ...base,
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    });
    const pending = await seedQuestion({
      ...base,
      semesterId: t.sem1.id,
      examTypeId: t.final.id,
    });
    const contributor = await seedUser("Sitemap Contributor");
    const uploader = await seedUser("Pending Uploader");
    const paper = await seedSubmission(published.id, {
      uploaderId: contributor.id,
    });
    await seedSubmission(pending.id, {
      uploaderId: uploader.id,
      status: "pending_review",
    });

    const res = await api("/api/v1/sitemap");
    expect(res.status).toBe(200);
    const body = await res.json<Sitemap>();
    expect(body.questions).toContainEqual({
      id: published.id,
      lastModified: paper.createdAt.toISOString(),
    });
    expect(body.questions.map((q) => q.id)).not.toContain(pending.id);
    const usernames = body.contributors.map((c) => c.username);
    expect(usernames).toContain(contributor.username);
    expect(usernames).not.toContain(uploader.username);
  });
});
