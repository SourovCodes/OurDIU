import {
  QUESTION_BANK_CACHE_TAG,
  REPORT_HIDE_THRESHOLD,
} from "@ourdiu/shared/constants";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { env } from "cloudflare:workers";
import { pendingCachePurges, submissionReports } from "../src/db/schema";
import { runPendingPurges } from "../src/services/cache";
import {
  api,
  db,
  jsonRequest,
  pdfFile,
  seedQuestion,
  seedSubmission,
  seedTaxonomy,
  signIn,
  signInAdmin,
  stubCachePurge,
} from "./helpers";

// Cloudflare's copies of the question bank's shared responses are cleared after
// changes visitors see (src/services/cache.ts), and only then (docs/PLAN.md, decision 62).

type Taxonomy = Awaited<ReturnType<typeof seedTaxonomy>>;

let admin: Awaited<ReturnType<typeof signInAdmin>>;
let t: Taxonomy;
let questionId: number;
let stub: ReturnType<typeof stubCachePurge>;

beforeAll(async () => {
  [admin, t] = await Promise.all([signInAdmin(), seedTaxonomy()]);
  questionId = (
    await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    })
  ).id;
});
beforeEach(async () => {
  stub = stubCachePurge();
  await db().delete(pendingCachePurges);
});
afterEach(() => stub.restore());

const PURGED = [[{ tags: [QUESTION_BANK_CACHE_TAG] }]];

const seedPaper = (status: "published" | "pending_review" = "published") =>
  seedSubmission(questionId, { status });

describe("clearing the question bank's cached pages", () => {
  it("follows an admin's decision on a paper", async () => {
    const paper = await seedPaper("pending_review");
    const res = await api(
      `/api/v1/admin/submissions/${paper.id}`,
      jsonRequest("PATCH", { status: "published" }, admin.cookie),
    );
    expect(res.status).toBe(200);
    expect(stub.purge.mock.calls).toEqual(PURGED);
  });

  it("follows catalog edits", async () => {
    const res = await api(
      "/api/v1/admin/exam-types",
      jsonRequest(
        "POST",
        { name: `Viva ${crypto.randomUUID()}` },
        admin.cookie,
      ),
    );
    expect(res.status).toBe(201);
    expect(stub.purge.mock.calls).toEqual(PURGED);
  });

  it("follows an upload, which visitors see as under review", async () => {
    const member = await signIn();
    const body = new FormData();
    body.append("departmentId", String(t.cse.id));
    body.append("courseId", String(t.algorithms.id));
    body.append("semesterId", String(t.sem1.id));
    body.append("examTypeId", String(t.final.id));
    body.append("file", pdfFile());
    const res = await api("/api/v1/submissions", {
      method: "POST",
      headers: { cookie: member.cookie },
      body,
    });
    expect(res.status).toBe(201);
    expect(stub.purge.mock.calls).toEqual(PURGED);
  });

  it("doesn't follow a change that failed", async () => {
    const res = await api(
      "/api/v1/admin/submissions/999999",
      jsonRequest("PATCH", { status: "published" }, admin.cookie),
    );
    expect(res.status).toBe(404);
    expect(stub.purge).not.toHaveBeenCalled();
  });

  it("doesn't follow votes, saves and views, whose counts catch up on their own", async () => {
    const member = await signIn();
    const paper = await seedPaper();
    expect(
      (
        await api(
          `/api/v1/submissions/${paper.id}/vote`,
          jsonRequest("PUT", { value: 1 }, member.cookie),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await api(`/api/v1/me/saved/${questionId}`, {
          method: "PUT",
          headers: { cookie: member.cookie },
        })
      ).status,
    ).toBeLessThan(300);
    expect(stub.purge).not.toHaveBeenCalled();
  });

  it(`follows a report only when it hides the paper (the ${REPORT_HIDE_THRESHOLD}th)`, async () => {
    const paper = await seedPaper();
    const reporters = await Promise.all(
      Array.from({ length: REPORT_HIDE_THRESHOLD }, () => signIn()),
    );
    for (const [i, reporter] of reporters.entries()) {
      const res = await api(
        `/api/v1/submissions/${paper.id}/reports`,
        jsonRequest("POST", { reason: "unreadable" }, reporter.cookie),
      );
      expect(res.status).toBe(201);
      expect(stub.purge).toHaveBeenCalledTimes(
        i === reporters.length - 1 ? 1 : 0,
      );
    }
  });

  it("follows a new name, which papers show", async () => {
    const member = await signIn();
    const res = await api(
      "/api/auth/update-user",
      jsonRequest("POST", { name: "Renamed Contributor" }, member.cookie),
    );
    expect(res.status).toBe(200);
    expect(stub.purge.mock.calls).toEqual(PURGED);
  });

  it("follows a merge, but not its dry run", async () => {
    const merge = (dryRun: boolean) =>
      api(
        "/api/v1/admin/semesters/merge",
        jsonRequest(
          "POST",
          { keepId: t.sem1.id, mergeIds: [t.sem2.id], dryRun },
          admin.cookie,
        ),
      );
    expect((await merge(true)).status).toBe(200);
    expect(stub.purge).not.toHaveBeenCalled();
    expect((await merge(false)).status).toBe(200);
    expect(stub.purge.mock.calls).toEqual(PURGED);
  });

  it("doesn't follow a report's resolution, which visitors don't see", async () => {
    const paper = await seedPaper();
    const reporter = await signIn();
    const [report] = await db()
      .insert(submissionReports)
      .values({
        submissionId: paper.id,
        reporterId: reporter.id,
        reason: "unreadable",
      })
      .returning();
    const res = await api(
      `/api/v1/admin/reports/${report!.id}`,
      jsonRequest("PATCH", { status: "dismissed" }, admin.cookie),
    );
    expect(res.status).toBe(200);
    expect(stub.purge).not.toHaveBeenCalled();
  });
});

const REFUSED: CachePurgeResult = {
  success: false,
  errors: [{ code: 1134, message: "Unable to purge, rate limit reached." }],
};

describe("purges Cloudflare refuses", () => {
  it("never fail the change, and are noted for the cron", async () => {
    stub.restore();
    stub = stubCachePurge(REFUSED);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const paper = await seedPaper("pending_review");
    const res = await api(
      `/api/v1/admin/submissions/${paper.id}`,
      jsonRequest("PATCH", { status: "published" }, admin.cookie),
    );
    expect(res.status).toBe(200);
    expect(stub.purge).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    expect(await db().select().from(pendingCachePurges)).toMatchObject([
      { tag: QUESTION_BANK_CACHE_TAG, fileKey: null },
    ]);
  });

  it("are made again by the cron, once for all, then their files deleted", async () => {
    const key = `watermarked/${crypto.randomUUID()}.pdf`;
    await env.BUCKET.put(key, "%PDF-1.7\nold copy");
    await db()
      .insert(pendingCachePurges)
      .values([
        { tag: QUESTION_BANK_CACHE_TAG },
        { tag: QUESTION_BANK_CACHE_TAG },
        { tag: QUESTION_BANK_CACHE_TAG, fileKey: key },
      ]);

    // Still refused: everything waits for the next run.
    stub.restore();
    stub = stubCachePurge(REFUSED);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await runPendingPurges(db(), env.BUCKET);
    warn.mockRestore();
    expect(await db().select().from(pendingCachePurges)).toHaveLength(3);
    expect(await env.BUCKET.head(key)).not.toBeNull();

    stub.restore();
    stub = stubCachePurge();
    await runPendingPurges(db(), env.BUCKET);
    expect(stub.purge.mock.calls).toEqual(PURGED);
    expect(await db().select().from(pendingCachePurges)).toEqual([]);
    expect(await env.BUCKET.head(key)).toBeNull();

    // Nothing noted: no purge.
    await runPendingPurges(db(), env.BUCKET);
    expect(stub.purge).toHaveBeenCalledOnce();
  });
});
