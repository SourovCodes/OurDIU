import {
  REPORT_HIDE_THRESHOLD,
  type CreatedReport,
  type QuestionDetail,
  type QuestionInteractions,
  type VoteResult,
} from "@ourdiu/shared";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  submissionReports,
  submissions,
  submissionVotes,
  user,
  type NewSubmissionRow,
} from "../src/db/schema";
import {
  MAX_REMEMBERED_VIEWS,
  VIEW_COOKIES,
  VIEW_WINDOW_MS,
} from "../src/lib/view-cookie";
import { createViewToken, VIEW_TOKEN_TTL_MS } from "../src/lib/view-token";
import {
  api,
  db,
  jsonRequest,
  seedQuestion,
  seedSubmission,
  seedTaxonomy,
  seedUser,
  signIn,
} from "./helpers";

async function seedQuestionWithPaper(
  overrides: Partial<NewSubmissionRow> = {},
) {
  const t = await seedTaxonomy();
  const question = await seedQuestion({
    departmentId: t.cse.id,
    courseId: t.algorithms.id,
    semesterId: t.sem1.id,
    examTypeId: t.midterm.id,
  });
  const submission = await seedSubmission(question.id, overrides);
  return { question, submission };
}

const findSubmission = (id: number) =>
  db().query.submissions.findFirst({ where: eq(submissions.id, id) });

const BROWSER =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

/** The view token the question's page gets. */
async function viewTokenFor(questionId: number) {
  const detail = await (
    await api(`/api/v1/questions/${questionId}`)
  ).json<QuestionDetail>();
  return detail.viewToken;
}

// Distinct issue times, all before any token the API issues during the tests.
const firstPageLoad = Date.now();
let pageLoads = 0;
/** Another visit's view token (each one counts each page once a minute). */
const anotherPageLoad = (questionId: number) =>
  createViewToken(
    env.BETTER_AUTH_SECRET,
    questionId,
    firstPageLoad - ++pageLoads,
  );

/** Counts a view the way the question page does, unless `headers` say otherwise. */
function countView(path: string, token: string, headers: HeadersInit = {}) {
  return api(`/api/v1/${path}/views`, {
    method: "POST",
    headers: {
      "x-view-token": token,
      "user-agent": BROWSER,
      "sec-fetch-site": "same-origin",
      ...headers,
    },
  });
}

/** A browser on the question page: it sends the token and keeps the view cookies. */
function browser(token: string) {
  const cookies = new Map<string, string>();
  return {
    async view(path: string) {
      const cookie = [...cookies.values()].join("; ");
      const res = await countView(path, token, cookie ? { cookie } : {});
      const set = res.headers.get("set-cookie");
      if (set) {
        const pair = set.split(";")[0]!;
        cookies.set(pair.split("=")[0]!, pair);
      }
      return res;
    },
  };
}

const viewCountOf = async (questionId: number) =>
  (await (await api(`/api/v1/questions/${questionId}`)).json<QuestionDetail>())
    .viewCount;

describe("view counters", () => {
  it("counts question page views from anyone, separately from paper views", async () => {
    const { question } = await seedQuestionWithPaper();
    for (const token of [
      await viewTokenFor(question.id),
      await anotherPageLoad(question.id),
    ]) {
      const res = await countView(`questions/${question.id}`, token);
      expect(res.status).toBe(204);
    }

    const detail = await (
      await api(`/api/v1/questions/${question.id}`)
    ).json<QuestionDetail>();
    expect(detail.viewCount).toBe(2);
    expect(detail.submissions[0]?.viewCount).toBe(0);

    const missing = await countView(
      "questions/999999",
      await createViewToken(env.BETTER_AUTH_SECRET, 999999),
    );
    expect(missing.status).toBe(404);
  });

  it("counts views of published papers only, without touching updated_at", async () => {
    const updatedAt = new Date("2024-01-01");
    const { submission } = await seedQuestionWithPaper({ updatedAt });
    const pending = await seedSubmission(submission.questionId!, {
      status: "pending_review",
    });
    const token = await viewTokenFor(submission.questionId!);

    const res = await countView(`submissions/${submission.id}`, token);
    expect(res.status).toBe(204);
    expect(await findSubmission(submission.id)).toMatchObject({
      viewCount: 1,
      updatedAt,
    });

    const hidden = await countView(`submissions/${pending.id}`, token);
    expect(hidden.status).toBe(404);
    expect((await findSubmission(pending.id))?.viewCount).toBe(0);
  });

  it("ignores views without a valid token for the paper's question page", async () => {
    const { question, submission } = await seedQuestionWithPaper();
    const other = await seedQuestionWithPaper();
    const token = await viewTokenFor(question.id);
    const otherToken = await viewTokenFor(other.question.id);
    const secret = env.BETTER_AUTH_SECRET;
    const expired = await createViewToken(
      secret,
      question.id,
      Date.now() - VIEW_TOKEN_TTL_MS - 1000,
    );
    const forged = await createViewToken("another-secret", question.id);

    for (const bad of [
      "",
      "garbage",
      `${token}.x`,
      otherToken,
      expired,
      forged,
    ]) {
      const res = await countView(`questions/${question.id}`, bad);
      expect(res.status).toBe(204);
      expect(
        (await countView(`submissions/${submission.id}`, bad)).status,
      ).toBe(204);
    }
    // No token header at all, as a script would send.
    expect(
      (await api(`/api/v1/questions/${question.id}/views`, { method: "POST" }))
        .status,
    ).toBe(204);

    expect(await viewCountOf(question.id)).toBe(0);
    expect((await findSubmission(submission.id))?.viewCount).toBe(0);
  });

  it("ignores views from crawlers, scripts and other sites", async () => {
    const { question } = await seedQuestionWithPaper();
    const token = await viewTokenFor(question.id);

    for (const userAgent of [
      "",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "curl/8.5.0",
      "python-requests/2.32.3",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0 Safari/537.36",
    ]) {
      await countView(`questions/${question.id}`, token, {
        "user-agent": userAgent,
      });
    }
    await countView(`questions/${question.id}`, token, {
      "sec-fetch-site": "cross-site",
    });
    expect(await viewCountOf(question.id)).toBe(0);

    // Apps don't send Sec-Fetch-Site.
    const headers = new Headers({
      "x-view-token": token,
      "user-agent": BROWSER,
    });
    await api(`/api/v1/questions/${question.id}/views`, {
      method: "POST",
      headers,
    });
    expect(await viewCountOf(question.id)).toBe(1);
  });

  it("lets many visitors behind one address count", async () => {
    const { question } = await seedQuestionWithPaper();
    for (let i = 0; i < 70; i++) {
      await countView(
        `questions/${question.id}`,
        await anotherPageLoad(question.id),
        { "cf-connecting-ip": "203.0.113.7" },
      );
    }
    expect(await viewCountOf(question.id)).toBe(70);
  });

  it("counts each page once per page load's token, however often it is sent", async () => {
    const { question, submission } = await seedQuestionWithPaper();
    const token = await viewTokenFor(question.id);
    // A script replaying one token, without keeping the cookie.
    for (let i = 0; i < 3; i++) {
      await countView(`questions/${question.id}`, token);
      await countView(`submissions/${submission.id}`, token);
    }
    expect(await viewCountOf(question.id)).toBe(1);
    expect((await findSubmission(submission.id))?.viewCount).toBe(1);

    // Loading the page again gives a token that counts again.
    await countView(
      `questions/${question.id}`,
      await anotherPageLoad(question.id),
    );
    expect(await viewCountOf(question.id)).toBe(2);
  });

  it("remembers a question page and its paper counted at the same time", async () => {
    const { question, submission } = await seedQuestionWithPaper();
    const token = await viewTokenFor(question.id);
    // The question page sends both views at once, from a browser with no cookie yet.
    const responses = await Promise.all([
      countView(`questions/${question.id}`, token),
      countView(`submissions/${submission.id}`, token),
    ]);
    const cookie = responses
      .map((res) => res.headers.get("set-cookie")!.split(";")[0])
      .join("; ");

    // Reloading the page with both cookies counts neither again.
    const reload = await anotherPageLoad(question.id);
    await countView(`questions/${question.id}`, reload, { cookie });
    await countView(`submissions/${submission.id}`, reload, { cookie });
    expect(await viewCountOf(question.id)).toBe(1);
    expect((await findSubmission(submission.id))?.viewCount).toBe(1);
  });

  it("counts a browser once a day per paper and per question page", async () => {
    const { question, submission } = await seedQuestionWithPaper();
    const other = await seedSubmission(question.id);
    const token = await viewTokenFor(question.id);
    const paper = `submissions/${submission.id}`;
    const page = `questions/${question.id}`;

    // Reloads count once; another browser (same campus IP) is another visitor.
    const mine = browser(token);
    for (let i = 0; i < 3; i++) {
      expect((await mine.view(paper)).status).toBe(204);
    }
    await browser(await anotherPageLoad(question.id)).view(paper);
    expect((await findSubmission(submission.id))?.viewCount).toBe(2);

    // The same browser still counts on the question page and another paper, once each.
    await mine.view(page);
    await mine.view(page);
    await mine.view(`submissions/${other.id}`);
    await mine.view(paper);
    expect(await viewCountOf(question.id)).toBe(1);
    expect((await findSubmission(other.id))?.viewCount).toBe(1);
    expect((await findSubmission(submission.id))?.viewCount).toBe(2);

    // A view remembered a day ago counts again.
    const dayAgo = Math.floor((Date.now() - VIEW_WINDOW_MS) / 60_000);
    await countView(paper, await anotherPageLoad(question.id), {
      cookie: `${VIEW_COOKIES.paper}=${submission.id}_${dayAgo.toString(36)}`,
    });
    expect((await findSubmission(submission.id))?.viewCount).toBe(3);

    // Remembered papers and crawlers are ignored before the paper is even loaded.
    const minute = Math.floor(Date.now() / 60_000).toString(36);
    const remembered = await countView("submissions/999999", token, {
      cookie: `${VIEW_COOKIES.paper}=999999_${minute}`,
    });
    expect(remembered.status).toBe(204);
    const crawler = await countView("submissions/999999", token, {
      "user-agent": "curl/8.5.0",
    });
    expect(crawler.status).toBe(204);

    // Unknown pages and ignored views don't set the cookie.
    const missing = await countView(
      "questions/999999",
      await createViewToken(env.BETTER_AUTH_SECRET, 999999),
    );
    expect(missing.status).toBe(404);
    expect(missing.headers.get("set-cookie")).toBeNull();
    const ignored = await countView(page, "garbage");
    expect(ignored.headers.get("set-cookie")).toBeNull();
  });

  it("keeps the cookie small and scoped to the API", async () => {
    const { submission } = await seedQuestionWithPaper();
    const token = await viewTokenFor(submission.questionId!);
    const minute = Math.floor(Date.now() / 60_000).toString(36);
    const full = Array.from(
      { length: MAX_REMEMBERED_VIEWS },
      (_, i) => `${i + 1_000_000}_${minute}`,
    ).join(".");
    const res = await countView(`submissions/${submission.id}`, token, {
      cookie: `${VIEW_COOKIES.paper}=${full}; other=junk`,
    });
    const set = res.headers.get("set-cookie")!;
    expect(set).toMatch(/Path=\/api\/v1/);
    expect(set).toMatch(/HttpOnly/);
    const entries = set
      .split(";")[0]!
      .slice(`${VIEW_COOKIES.paper}=`.length)
      .split(".");
    expect(entries).toHaveLength(MAX_REMEMBERED_VIEWS);
    expect(entries[0]).toBe(`1000001_${minute}`);
    expect(entries.at(-1)).toBe(`${submission.id}_${minute}`);

    // Garbage in the cookie is ignored rather than failing the request.
    const junk = await countView(
      `submissions/${submission.id}`,
      await anotherPageLoad(submission.questionId!),
      { cookie: `${VIEW_COOKIES.paper}=nonsense.x_y._.s_zz` },
    );
    expect(junk.status).toBe(204);
    expect((await findSubmission(submission.id))?.viewCount).toBe(2);
  });
});

describe("PUT and DELETE /api/v1/submissions/{id}/vote", () => {
  const vote = (id: number, value: number, cookie?: string) =>
    api(
      `/api/v1/submissions/${id}/vote`,
      jsonRequest("PUT", { value }, cookie),
    );

  it("requires sign-in", async () => {
    const { submission } = await seedQuestionWithPaper();
    expect((await vote(submission.id, 1)).status).toBe(401);
  });

  it("keeps like and dislike counts in sync as votes change", async () => {
    const { submission } = await seedQuestionWithPaper();
    const alice = await signIn();
    const bob = await signIn();

    const liked = await vote(submission.id, 1, alice.cookie);
    expect(liked.status).toBe(200);
    expect(await liked.json<VoteResult>()).toEqual({
      likeCount: 1,
      dislikeCount: 0,
      viewCount: 0,
      myVote: 1,
    });

    expect(
      await (await vote(submission.id, -1, bob.cookie)).json<VoteResult>(),
    ).toMatchObject({ likeCount: 1, dislikeCount: 1, myVote: -1 });

    // Changing a vote moves it between the counters; repeating it changes nothing.
    expect(
      await (await vote(submission.id, -1, alice.cookie)).json<VoteResult>(),
    ).toMatchObject({ likeCount: 0, dislikeCount: 2, myVote: -1 });
    expect(
      await (await vote(submission.id, -1, alice.cookie)).json<VoteResult>(),
    ).toMatchObject({ likeCount: 0, dislikeCount: 2 });

    const removed = await api(`/api/v1/submissions/${submission.id}/vote`, {
      method: "DELETE",
      headers: { cookie: bob.cookie },
    });
    expect(removed.status).toBe(200);
    expect(await removed.json<VoteResult>()).toMatchObject({
      likeCount: 0,
      dislikeCount: 1,
      myVote: null,
    });
    expect(await findSubmission(submission.id)).toMatchObject({
      likeCount: 0,
      dislikeCount: 1,
    });
  });

  it("rejects invalid values, votes on your own paper and unpublished papers", async () => {
    const owner = await signIn();
    const voter = await signIn();
    const { submission } = await seedQuestionWithPaper({
      uploaderId: owner.id,
    });
    const pending = await seedSubmission(submission.questionId!, {
      status: "pending_review",
    });

    expect((await vote(submission.id, 2, voter.cookie)).status).toBe(422);
    expect((await vote(submission.id, 1, owner.cookie)).status).toBe(403);
    expect((await vote(pending.id, 1, voter.cookie)).status).toBe(404);
  });

  it("removes a deleted user's votes from the counts", async () => {
    const { submission } = await seedQuestionWithPaper();
    const voter = await seedUser("Soon Gone");
    await db()
      .insert(submissionVotes)
      .values({ submissionId: submission.id, userId: voter.id, value: 1 });
    expect((await findSubmission(submission.id))?.likeCount).toBe(1);

    await db().delete(user).where(eq(user.id, voter.id));
    expect((await findSubmission(submission.id))?.likeCount).toBe(0);
  });
});

describe("submission ranking", () => {
  it("ranks papers within a status by score, then views, then newest", async () => {
    const { question, submission: lowScore } = await seedQuestionWithPaper({
      createdAt: new Date("2025-06-01"),
    });
    const topScore = await seedSubmission(question.id, {
      createdAt: new Date("2024-01-01"),
    });
    const tiedMoreViews = await seedSubmission(question.id, {
      createdAt: new Date("2024-01-01"),
      viewCount: 50,
    });
    const tiedNewer = await seedSubmission(question.id, {
      createdAt: new Date("2025-01-01"),
    });
    const pending = await seedSubmission(question.id, {
      status: "pending_review",
    });

    const [a, b] = await Promise.all([seedUser("A"), seedUser("B")]);
    await db()
      .insert(submissionVotes)
      .values([
        { submissionId: topScore.id, userId: a.id, value: 1 },
        { submissionId: topScore.id, userId: b.id, value: 1 },
        { submissionId: lowScore.id, userId: a.id, value: -1 },
        // Votes never lift an unpublished paper above published ones.
        { submissionId: pending.id, userId: a.id, value: 1 },
        { submissionId: pending.id, userId: b.id, value: 1 },
      ]);

    const detail = await (
      await api(`/api/v1/questions/${question.id}`)
    ).json<QuestionDetail>();
    expect(detail.submissions.map((s) => s.id)).toEqual([
      topScore.id,
      tiedMoreViews.id,
      tiedNewer.id,
      lowScore.id,
      pending.id,
    ]);
    expect(detail.submissions[0]).toMatchObject({
      likeCount: 2,
      dislikeCount: 0,
    });
  });
});

describe("GET /api/v1/me/questions/{id}/interactions", () => {
  it("returns the user's votes and open reports on the question's papers", async () => {
    const me = await signIn();
    const { question, submission } = await seedQuestionWithPaper();
    const other = await seedSubmission(question.id);
    await db()
      .insert(submissionVotes)
      .values({ submissionId: submission.id, userId: me.id, value: -1 });
    await db()
      .insert(submissionReports)
      .values([
        { submissionId: other.id, reporterId: me.id, reason: "duplicate" },
        {
          submissionId: submission.id,
          reporterId: me.id,
          reason: "unreadable",
          status: "dismissed",
        },
      ]);

    const path = `/api/v1/me/questions/${question.id}/interactions`;
    const res = await api(path, { headers: { cookie: me.cookie } });
    expect(res.status).toBe(200);
    expect(await res.json<QuestionInteractions>()).toEqual({
      userId: me.id,
      votes: [{ submissionId: submission.id, value: -1 }],
      reportedSubmissionIds: [other.id],
    });
    expect((await api(path)).status).toBe(401);
  });
});

describe("POST /api/v1/submissions/{id}/reports", () => {
  const report = (
    id: number,
    cookie?: string,
    body: object = { reason: "unreadable" },
  ) =>
    api(`/api/v1/submissions/${id}/reports`, jsonRequest("POST", body, cookie));

  it("requires sign-in", async () => {
    const { submission } = await seedQuestionWithPaper();
    expect((await report(submission.id)).status).toBe(401);
  });

  it("files one open report per user, never on their own paper", async () => {
    const owner = await signIn();
    const reporter = await signIn();
    const { submission } = await seedQuestionWithPaper({
      uploaderId: owner.id,
    });

    const res = await report(submission.id, reporter.cookie, {
      reason: "wrong_details",
      details: "This is the final, not the midterm",
    });
    expect(res.status).toBe(201);
    expect(await res.json<CreatedReport>()).toMatchObject({
      status: "pending",
      submissionHidden: false,
    });

    const again = await report(submission.id, reporter.cookie);
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({
      error: { code: "ALREADY_REPORTED" },
    });
    expect((await report(submission.id, owner.cookie)).status).toBe(403);
    // "Other" needs a description.
    expect(
      (await report(submission.id, reporter.cookie, { reason: "other" }))
        .status,
    ).toBe(422);

    expect(await findSubmission(submission.id)).toMatchObject({
      status: "published",
      pendingReportCount: 1,
    });
  });

  it(`hides a published paper once ${REPORT_HIDE_THRESHOLD} users report it`, async () => {
    const { submission } = await seedQuestionWithPaper();
    const reporters = await Promise.all(
      Array.from({ length: REPORT_HIDE_THRESHOLD }, () => signIn()),
    );

    for (const [i, reporter] of reporters.entries()) {
      const created = await (
        await report(submission.id, reporter.cookie)
      ).json<CreatedReport>();
      expect(created.submissionHidden).toBe(i === reporters.length - 1);
    }

    expect(await findSubmission(submission.id)).toMatchObject({
      status: "pending_review",
      pendingReportCount: REPORT_HIDE_THRESHOLD,
    });
    expect(
      (await api(`/api/v1/submissions/${submission.id}/file`)).status,
    ).toBe(404);

    // Hidden papers can't be reported (or voted on) any more.
    const late = await signIn();
    expect((await report(submission.id, late.cookie)).status).toBe(404);
  });

  it("keeps the open report count in sync as reports are reviewed", async () => {
    const { submission } = await seedQuestionWithPaper();
    const [a, b] = await Promise.all([seedUser("A"), seedUser("B")]);
    const [first, second] = await db()
      .insert(submissionReports)
      .values([
        { submissionId: submission.id, reporterId: a.id, reason: "duplicate" },
        { submissionId: submission.id, reporterId: b.id, reason: "wrong_file" },
      ])
      .returning();
    expect((await findSubmission(submission.id))?.pendingReportCount).toBe(2);

    await db()
      .update(submissionReports)
      .set({ status: "dismissed" })
      .where(eq(submissionReports.id, first!.id));
    expect((await findSubmission(submission.id))?.pendingReportCount).toBe(1);

    // A dismissed report doesn't block a new one from the same user.
    await db().insert(submissionReports).values({
      submissionId: submission.id,
      reporterId: a.id,
      reason: "other",
    });
    expect((await findSubmission(submission.id))?.pendingReportCount).toBe(2);

    await db()
      .delete(submissionReports)
      .where(eq(submissionReports.id, second!.id));
    expect((await findSubmission(submission.id))?.pendingReportCount).toBe(1);
  });
});
