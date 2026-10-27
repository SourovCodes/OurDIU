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
import {
  api,
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
// changes visitors see (src/lib/cache.ts), and only then (docs/PLAN.md, decision 62).

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
beforeEach(() => {
  stub = stubCachePurge();
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

  it("never fails the change when Cloudflare refuses the purge", async () => {
    stub.restore();
    stub = stubCachePurge({
      success: false,
      errors: [{ code: 1134, message: "Unable to purge, rate limit reached." }],
    });
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
  });
});
