import { env } from "cloudflare:workers";
import type { CreatedSubmission, QuestionDetail } from "@ourdiu/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { submissions } from "../src/db/schema";
import { hashNextPapers, sha256Hex } from "../src/services/duplicates";
import {
  api,
  db,
  pdfFile,
  seedQuestion,
  seedSubmission,
  seedTaxonomy,
  signIn,
} from "./helpers";

function upload(fields: Record<string, number>, cookie: string, file: File) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    body.append(key, String(value));
  }
  body.append("file", file);
  return api("/api/v1/submissions", {
    method: "POST",
    headers: { cookie },
    body,
  });
}

const hashOf = async (file: File) => sha256Hex(await file.arrayBuffer());

describe("duplicate files", () => {
  it("refuses a file that is already on the site, but not a rejected one", async () => {
    const t = await seedTaxonomy();
    const { cookie } = await signIn();
    const fields = {
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    };
    const file = pdfFile("paper.pdf", "same paper");

    const first = await upload(fields, cookie, file);
    expect(first.status).toBe(201);
    const created = await first.json<CreatedSubmission>();
    expect(
      (
        await db().query.submissions.findFirst({
          where: eq(submissions.id, created.id),
        })
      )?.fileSha256,
    ).toBe(await hashOf(file));

    // Again, by anyone, under any name: refused, and nothing is stored.
    const other = await signIn();
    const again = await upload(
      fields,
      other.cookie,
      pdfFile("copy.pdf", "same paper"),
    );
    expect(again.status).toBe(409);
    expect((await again.json<{ error: { code: string } }>()).error.code).toBe(
      "DUPLICATE_FILE",
    );

    // Once the first is rejected, the file may come again.
    await db()
      .update(submissions)
      .set({ status: "rejected", rejectionReason: "Wrong course" })
      .where(eq(submissions.id, created.id));
    expect((await upload(fields, cookie, file)).status).toBe(201);
  });

  it("shows a file published twice once, keeping the copy with the most votes", async () => {
    const t = await seedTaxonomy();
    const question = await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem2.id,
      examTypeId: t.final.id,
    });
    const first = await seedSubmission(question.id, { fileSha256: "aaa" });
    const liked = await seedSubmission(question.id, {
      fileSha256: "aaa",
      likeCount: 2,
    });
    const other = await seedSubmission(question.id, { fileSha256: "bbb" });
    // Not hashed yet, or its file is missing: always shown.
    const unhashed = await seedSubmission(question.id);
    const missing = await seedSubmission(question.id, { fileSha256: "" });

    const detail = await (
      await api(`/api/v1/questions/${question.id}`)
    ).json<QuestionDetail>();
    const ids = detail.submissions.map((s) => s.id);
    expect(ids).toContain(liked.id);
    expect(ids).not.toContain(first.id);
    expect(ids).toEqual(
      expect.arrayContaining([other.id, unhashed.id, missing.id]),
    );
    expect(ids).toHaveLength(4);
  });

  it("hashes older papers' files in the cron", async () => {
    const t = await seedTaxonomy();
    const question = await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.final.id,
    });
    const file = pdfFile();
    const stored = await seedSubmission(question.id);
    await env.BUCKET.put(stored.fileKey, await file.arrayBuffer());
    const gone = await seedSubmission(question.id);

    while ((await hashNextPapers(db(), env.BUCKET)) > 0);
    const row = (id: number) =>
      db().query.submissions.findFirst({ where: eq(submissions.id, id) });
    expect((await row(stored.id))?.fileSha256).toBe(await hashOf(file));
    expect((await row(stored.id))?.updatedAt).toEqual(stored.updatedAt);
    expect((await row(gone.id))?.fileSha256).toBe("");
  });
});
