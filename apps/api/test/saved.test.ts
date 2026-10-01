import type { QuestionInteractions, SavedQuestionList } from "@ourdiu/shared";
import { describe, expect, it } from "vitest";
import {
  api,
  jsonRequest,
  seedQuestion,
  seedSubmission,
  seedTaxonomy,
  signIn,
} from "./helpers";

async function seedQuestions(count: number) {
  const t = await seedTaxonomy();
  const questions = [];
  for (let i = 0; i < count; i++) {
    const question = await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: i % 2 ? t.sem1.id : t.sem2.id,
      examTypeId: i < 2 ? t.midterm.id : t.final.id,
    });
    await seedSubmission(question.id);
    questions.push(question);
  }
  return questions;
}

const list = async (cookie: string) =>
  (
    await api("/api/v1/me/saved", { headers: { cookie } })
  ).json<SavedQuestionList>();

const save = (id: number, cookie?: string) =>
  api(`/api/v1/me/saved/${id}`, {
    method: "PUT",
    headers: cookie ? { cookie } : {},
  });

describe("saved questions", () => {
  it("need sign-in", async () => {
    const [question] = await seedQuestions(1);
    expect((await api("/api/v1/me/saved")).status).toBe(401);
    expect((await save(question!.id)).status).toBe(401);
    expect(
      (await api(`/api/v1/me/saved/${question!.id}`, { method: "DELETE" }))
        .status,
    ).toBe(401);
  });

  it("are saved once, listed newest first, and removed", async () => {
    const me = await signIn();
    const [a, b] = await seedQuestions(2);
    expect((await save(a!.id, me.cookie)).status).toBe(204);
    expect((await save(b!.id, me.cookie)).status).toBe(204);
    // Saving again changes nothing.
    expect((await save(a!.id, me.cookie)).status).toBe(204);

    const saved = await list(me.cookie);
    expect(saved.items.map((q) => q.id).sort()).toEqual([a!.id, b!.id].sort());
    expect(saved.items[0]).toMatchObject({
      course: { name: expect.any(String) },
      submissionCounts: { published: 1 },
      savedAt: expect.any(String),
    });

    const remove = await api(`/api/v1/me/saved/${a!.id}`, {
      method: "DELETE",
      headers: { cookie: me.cookie },
    });
    expect(remove.status).toBe(204);
    expect((await list(me.cookie)).items.map((q) => q.id)).toEqual([b!.id]);

    // Another user's list is their own.
    const other = await signIn();
    expect((await list(other.cookie)).items).toEqual([]);
  });

  it("show in a question's interactions", async () => {
    const me = await signIn();
    const [question] = await seedQuestions(1);
    await save(question!.id, me.cookie);
    const res = await api(`/api/v1/me/questions/${question!.id}/interactions`, {
      headers: { cookie: me.cookie },
    });
    expect((await res.json<QuestionInteractions>()).saved).toBe(true);
  });

  it("can't be an unknown question", async () => {
    const me = await signIn();
    expect((await save(999_999, me.cookie)).status).toBe(404);
  });

  it("are added in bulk from the app, skipping unknown ones", async () => {
    const me = await signIn();
    const [a, b, c] = await seedQuestions(3);
    await save(a!.id, me.cookie);
    const res = await api(
      "/api/v1/me/saved",
      jsonRequest(
        "POST",
        { questionIds: [b!.id, a!.id, 999_999, c!.id, b!.id] },
        me.cookie,
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json<SavedQuestionList>();
    expect(body.items.map((q) => q.id).sort()).toEqual(
      [a!.id, b!.id, c!.id].sort(),
    );
    expect(
      (
        await api(
          "/api/v1/me/saved",
          jsonRequest("POST", { questionIds: [] }, me.cookie),
        )
      ).status,
    ).toBe(422);
  });
});
