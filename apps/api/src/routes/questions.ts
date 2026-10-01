import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  idQuerySchema,
  listQuestionsQuerySchema,
  questionDetailSchema,
  questionListSchema,
} from "@ourdiu/shared";
import { AppError, validationHook } from "../lib/errors";
import { errorResponse, jsonResponse } from "../lib/openapi";
import { createViewToken } from "../lib/view-token";
import { getQuestion, listQuestions } from "../services/questions";
import type { AppEnv } from "../types";

const tags = ["Questions"];

const listQuestionsRoute = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "List questions that have published submissions",
  request: { query: listQuestionsQuerySchema },
  responses: {
    200: jsonResponse(questionListSchema, "Questions"),
    422: errorResponse("Invalid query"),
  },
});

const getQuestionRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags,
  summary: "Get a question with its published submissions",
  request: { params: z.object({ id: idQuerySchema }) },
  responses: {
    200: jsonResponse(questionDetailSchema, "Question"),
    404: errorResponse("Question not found"),
    422: errorResponse("Invalid id"),
  },
});

export const questionRoutes = new OpenAPIHono<AppEnv>({
  defaultHook: validationHook,
})
  .openapi(listQuestionsRoute, async (c) =>
    c.json(await listQuestions(c.var.db, c.req.valid("query")), 200),
  )
  .openapi(getQuestionRoute, async (c) => {
    const question = await getQuestion(
      c.var.db,
      c.req.valid("param").id,
      c.env.FILES_URL,
    );
    if (!question) throw new AppError(404, "NOT_FOUND", "Question not found");
    const viewToken = await createViewToken(
      c.env.BETTER_AUTH_SECRET,
      question.id,
    );
    return c.json({ ...question, viewToken }, 200);
  });
