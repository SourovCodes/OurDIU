import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import {
  castVoteInputSchema,
  createdReportSchema,
  createReportInputSchema,
  idQuerySchema,
  questionInteractionsSchema,
  savedQuestionListSchema,
  saveQuestionsInputSchema,
  voteResultSchema,
} from "@ourdiu/shared";
import { AppError, validationHook } from "../lib/errors";
import { errorResponse, jsonResponse } from "../lib/openapi";
import { readViews, rememberView } from "../lib/view-cookie";
import { isBrowserRequest, verifyViewToken } from "../lib/view-token";
import { rateLimit } from "../middleware/rate-limit";
import { requireAuth } from "../middleware/require-auth";
import {
  castVote,
  getQuestionInteractions,
  publishedSubmissionQuestionId,
  recordQuestionView,
  recordSubmissionView,
  removeVote,
  reportSubmission,
} from "../services/engagement";
import {
  listSavedQuestions,
  saveQuestion,
  saveQuestions,
  unsaveQuestion,
} from "../services/saved";
import type { AppEnv } from "../types";

const tags = ["Engagement"];
const questionParams = z.object({ id: idQuerySchema });
const submissionParams = z.object({ id: idQuerySchema });
const voteLimit = rateLimit(
  "VOTE_LIMITER",
  "You're voting too fast. Please wait a minute and try again.",
);
const reportLimit = rateLimit(
  "REPORT_LIMITER",
  "You've sent a lot of reports. Please wait a minute and try again.",
);
const VIEW_DESCRIPTION =
  "Public and unauthenticated. Counts only views sent from the question's page: " +
  "`viewToken` from `GET /questions/{id}` in `X-View-Token`, from a browser or app " +
  "rather than a crawler or script. A token counts each page at most once a minute, " +
  "and a browser once a day. Other requests are ignored, still with 204.";
const viewHeaders = z.object({
  "x-view-token": z
    .string()
    .optional()
    .openapi({ description: "The question's `viewToken`" }),
});

/**
 * Whether this is a browser's first view of the page today (the view cookie) from
 * a person rather than a crawler or another site. Costs no D1 read or crypto.
 */
function isNewBrowserView(
  c: Context<AppEnv>,
  views: Map<number, number>,
  id: number,
) {
  return (
    !views.has(id) &&
    isBrowserRequest({
      userAgent: c.req.header("user-agent"),
      fetchSite: c.req.header("sec-fetch-site"),
    })
  );
}

/**
 * Whether the request's view token counts a view of page `page` (`q12`, `s5`) of
 * question `questionId`: valid, and not already used for that page in the last minute.
 */
async function tokenCounts(
  c: Context<AppEnv>,
  questionId: number,
  page: string,
) {
  const token = c.req.header("x-view-token");
  if (!(await verifyViewToken(c.env.BETTER_AUTH_SECRET, token, questionId))) {
    return false;
  }
  const { success } = await c.env.VIEW_LIMITER.limit({
    key: `${page}:${token}`,
  });
  return success;
}

const jsonBody = <T extends z.ZodType>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
});

const recordQuestionViewRoute = createRoute({
  method: "post",
  path: "/questions/{id}/views",
  tags,
  summary: "Count a question page view",
  description: VIEW_DESCRIPTION,
  request: { params: questionParams, headers: viewHeaders },
  responses: {
    204: { description: "Counted, or ignored as not a visitor's view" },
    404: errorResponse("Question not found"),
    422: errorResponse("Invalid id"),
  },
});

const recordSubmissionViewRoute = createRoute({
  method: "post",
  path: "/submissions/{id}/views",
  tags,
  summary: "Count a view of a published paper",
  description: VIEW_DESCRIPTION,
  request: { params: submissionParams, headers: viewHeaders },
  responses: {
    204: { description: "Counted, or ignored as not a visitor's view" },
    404: errorResponse("Submission not found or not published"),
  },
});

const castVoteRoute = createRoute({
  method: "put",
  path: "/submissions/{id}/vote",
  tags,
  summary: "Like (1) or dislike (-1) a published paper",
  middleware: [requireAuth, voteLimit] as const,
  request: {
    params: submissionParams,
    body: jsonBody(castVoteInputSchema),
  },
  responses: {
    200: jsonResponse(voteResultSchema, "Updated counts and your vote"),
    401: errorResponse("Not signed in"),
    403: errorResponse("You can't vote on your own paper"),
    404: errorResponse("Submission not found or not published"),
    422: errorResponse("Invalid vote"),
    429: errorResponse("Too many votes"),
  },
});

const removeVoteRoute = createRoute({
  method: "delete",
  path: "/submissions/{id}/vote",
  tags,
  summary: "Remove your like or dislike",
  middleware: [requireAuth, voteLimit] as const,
  request: { params: submissionParams },
  responses: {
    200: jsonResponse(voteResultSchema, "Updated counts"),
    401: errorResponse("Not signed in"),
    403: errorResponse("You can't vote on your own paper"),
    404: errorResponse("Submission not found or not published"),
    429: errorResponse("Too many votes"),
  },
});

const reportSubmissionRoute = createRoute({
  method: "post",
  path: "/submissions/{id}/reports",
  tags,
  summary: "Report a problem with a published paper",
  description:
    "Reports are reviewed by an admin. A paper with 3 open reports from different users is hidden (moved back to pending review) automatically.",
  middleware: [requireAuth, reportLimit] as const,
  request: {
    params: submissionParams,
    body: jsonBody(createReportInputSchema),
  },
  responses: {
    201: jsonResponse(createdReportSchema, "Report filed"),
    401: errorResponse("Not signed in"),
    403: errorResponse("You can't report your own paper"),
    404: errorResponse("Submission not found or not published"),
    409: errorResponse("You already have an open report on this paper"),
    422: errorResponse("Invalid report"),
    429: errorResponse("Too many reports"),
  },
});

const questionInteractionsRoute = createRoute({
  method: "get",
  path: "/me/questions/{id}/interactions",
  tags,
  summary: "Your votes and open reports on a question's papers",
  middleware: [requireAuth] as const,
  request: { params: questionParams },
  responses: {
    200: jsonResponse(questionInteractionsSchema, "Your interactions"),
    401: errorResponse("Not signed in"),
    422: errorResponse("Invalid id"),
  },
});

const savedTags = ["Saved"];

const listSavedRoute = createRoute({
  method: "get",
  path: "/me/saved",
  tags: savedTags,
  summary: "Your saved questions",
  description:
    "Questions you saved (bookmarked), most recently saved first. The same list on the website and in the app.",
  middleware: [requireAuth] as const,
  responses: {
    200: jsonResponse(savedQuestionListSchema, "Your saved questions"),
    401: errorResponse("Not signed in"),
  },
});

const saveQuestionRoute = createRoute({
  method: "put",
  path: "/me/saved/{id}",
  tags: savedTags,
  summary: "Save a question",
  description: "Saving one that is already saved changes nothing.",
  middleware: [requireAuth] as const,
  request: { params: questionParams },
  responses: {
    204: { description: "Saved" },
    401: errorResponse("Not signed in"),
    404: errorResponse("Question not found"),
    409: errorResponse("Too many saved questions"),
    422: errorResponse("Invalid id"),
  },
});

const saveQuestionsRoute = createRoute({
  method: "post",
  path: "/me/saved",
  tags: savedTags,
  summary: "Save several questions",
  description:
    "For the app's saved list when the user signs in. Questions already saved stay; unknown ids are ignored.",
  middleware: [requireAuth] as const,
  request: { body: jsonBody(saveQuestionsInputSchema) },
  responses: {
    200: jsonResponse(savedQuestionListSchema, "Your saved questions now"),
    401: errorResponse("Not signed in"),
    409: errorResponse("Too many saved questions"),
    422: errorResponse("Invalid list"),
  },
});

const unsaveQuestionRoute = createRoute({
  method: "delete",
  path: "/me/saved/{id}",
  tags: savedTags,
  summary: "Remove a saved question",
  description: "Removing one that isn't saved changes nothing.",
  middleware: [requireAuth] as const,
  request: { params: questionParams },
  responses: {
    204: { description: "Removed" },
    401: errorResponse("Not signed in"),
    422: errorResponse("Invalid id"),
  },
});

export const engagementRoutes = new OpenAPIHono<AppEnv>({
  defaultHook: validationHook,
})
  .openapi(recordQuestionViewRoute, async (c) => {
    const { id } = c.req.valid("param");
    const views = readViews(c, "question");
    // Ignored views get their 204 before the 404, which never needs a token.
    if (
      !isNewBrowserView(c, views, id) ||
      !(await tokenCounts(c, id, `q${id}`))
    ) {
      return c.body(null, 204);
    }
    if (!(await recordQuestionView(c.var.db, id))) {
      throw new AppError(404, "NOT_FOUND", "Question not found");
    }
    rememberView(c, "question", views, id);
    return c.body(null, 204);
  })
  .openapi(recordSubmissionViewRoute, async (c) => {
    const { id } = c.req.valid("param");
    const views = readViews(c, "paper");
    // Repeats and crawlers are ignored before the paper is loaded.
    if (!isNewBrowserView(c, views, id)) return c.body(null, 204);
    const questionId = await publishedSubmissionQuestionId(c.var.db, id);
    if (questionId === null) {
      throw new AppError(404, "NOT_FOUND", "Submission not found");
    }
    // The token is the paper's question page's.
    if (await tokenCounts(c, questionId, `s${id}`)) {
      await recordSubmissionView(c.var.db, id);
      rememberView(c, "paper", views, id);
    }
    return c.body(null, 204);
  })
  .openapi(castVoteRoute, async (c) =>
    c.json(
      await castVote(
        c.var.db,
        c.req.valid("param").id,
        c.var.session!.user.id,
        c.req.valid("json").value,
      ),
      200,
    ),
  )
  .openapi(removeVoteRoute, async (c) =>
    c.json(
      await removeVote(
        c.var.db,
        c.req.valid("param").id,
        c.var.session!.user.id,
      ),
      200,
    ),
  )
  .openapi(reportSubmissionRoute, async (c) =>
    c.json(
      await reportSubmission(
        c.var.db,
        c.req.valid("param").id,
        c.var.session!.user.id,
        c.req.valid("json"),
      ),
      201,
    ),
  )
  .openapi(questionInteractionsRoute, async (c) =>
    c.json(
      await getQuestionInteractions(
        c.var.db,
        c.req.valid("param").id,
        c.var.session!.user.id,
      ),
      200,
    ),
  )
  .openapi(listSavedRoute, async (c) =>
    c.json(await listSavedQuestions(c.var.db, c.var.session!.user.id), 200),
  )
  .openapi(saveQuestionRoute, async (c) => {
    await saveQuestion(
      c.var.db,
      c.var.session!.user.id,
      c.req.valid("param").id,
    );
    return c.body(null, 204);
  })
  .openapi(saveQuestionsRoute, async (c) => {
    const userId = c.var.session!.user.id;
    await saveQuestions(c.var.db, userId, c.req.valid("json").questionIds);
    return c.json(await listSavedQuestions(c.var.db, userId), 200);
  })
  .openapi(unsaveQuestionRoute, async (c) => {
    await unsaveQuestion(
      c.var.db,
      c.var.session!.user.id,
      c.req.valid("param").id,
    );
    return c.body(null, 204);
  });
