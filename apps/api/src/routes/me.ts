import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  createSubmissionInputSchema,
  idQuerySchema,
  updateUsernameInputSchema,
  USERNAME_RULES,
  mySubmissionDetailSchema,
  mySubmissionListSchema,
  profileSchema,
} from "@ourdiu/shared";
import { AppError, validationHook } from "../lib/errors";
import { objectResponse } from "../lib/files";
import { errorResponse, jsonResponse } from "../lib/openapi";
import { requireAuth } from "../middleware/require-auth";
import {
  getProfile,
  getOwnSubmission,
  getOwnSubmissionFile,
  listOwnSubmissions,
  reclassifyOwnSubmission,
  updateUsername,
  withdrawSubmission,
} from "../services/account";
import type { AppEnv } from "../types";

const tags = ["Account"];
const idParams = z.object({ id: idQuerySchema });

const getProfileRoute = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "Get your profile and the counts on your contributor page",
  middleware: [requireAuth] as const,
  responses: {
    200: jsonResponse(profileSchema, "Your profile"),
    401: errorResponse("Not signed in"),
  },
});

const listMySubmissionsRoute = createRoute({
  method: "get",
  path: "/submissions",
  tags,
  summary: "List your own submissions, in every status",
  middleware: [requireAuth] as const,
  responses: {
    200: jsonResponse(mySubmissionListSchema, "Your submissions"),
    401: errorResponse("Not signed in"),
  },
});

const getMySubmissionRoute = createRoute({
  method: "get",
  path: "/submissions/{id}",
  tags,
  summary: "Get one of your submissions with its review status and AI check",
  middleware: [requireAuth] as const,
  request: { params: idParams },
  responses: {
    200: jsonResponse(mySubmissionDetailSchema, "Your submission"),
    401: errorResponse("Not signed in"),
    404: errorResponse("Submission not found"),
  },
});

const reclassifyMySubmissionRoute = createRoute({
  method: "put",
  path: "/submissions/{id}/classification",
  tags,
  summary: "Correct the details of one of your papers waiting for review",
  description:
    "Same fields as uploading. The new details are compared with the AI check's " +
    "reading, and the paper is published right away if they match.",
  middleware: [requireAuth] as const,
  request: {
    params: idParams,
    body: {
      required: true,
      content: { "application/json": { schema: createSubmissionInputSchema } },
    },
  },
  responses: {
    200: jsonResponse(mySubmissionDetailSchema, "Updated submission"),
    401: errorResponse("Not signed in"),
    404: errorResponse("Submission not found"),
    409: errorResponse("The paper isn't waiting for review"),
    422: errorResponse("Invalid details"),
  },
});

const getMySubmissionFileRoute = createRoute({
  method: "get",
  path: "/submissions/{id}/file",
  tags,
  summary: "Download the PDF of one of your submissions, in any status",
  middleware: [requireAuth] as const,
  request: { params: idParams },
  responses: {
    200: {
      description: "PDF file",
      content: {
        "application/pdf": {
          schema: z.string().openapi({ format: "binary" }),
        },
      },
    },
    401: errorResponse("Not signed in"),
    404: errorResponse("Submission not found"),
  },
});

const withdrawMySubmissionRoute = createRoute({
  method: "delete",
  path: "/submissions/{id}",
  tags,
  summary: "Withdraw one of your submissions that isn't published",
  middleware: [requireAuth] as const,
  request: { params: idParams },
  responses: {
    204: { description: "Withdrawn; the PDF is deleted" },
    401: errorResponse("Not signed in"),
    404: errorResponse("Submission not found"),
    409: errorResponse("Published submissions can't be withdrawn"),
  },
});

const updateUsernameRoute = createRoute({
  method: "put",
  path: "/username",
  tags,
  summary: "Change your username",
  description: `Used in your contributor page's URL. ${USERNAME_RULES}; saved in lowercase.`,
  middleware: [requireAuth] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: updateUsernameInputSchema } },
    },
  },
  responses: {
    200: jsonResponse(updateUsernameInputSchema, "Your new username"),
    401: errorResponse("Not signed in"),
    409: errorResponse("Someone already has that username"),
    422: errorResponse("Not a valid username"),
  },
});

export const meRoutes = new OpenAPIHono<AppEnv>({
  defaultHook: validationHook,
})
  .openapi(getProfileRoute, async (c) =>
    c.json(await getProfile(c.var.db, c.var.session!.user.id), 200),
  )
  .openapi(listMySubmissionsRoute, async (c) =>
    c.json(
      {
        items: await listOwnSubmissions(c.var.db, c.var.session!.user.id),
      },
      200,
    ),
  )
  .openapi(getMySubmissionRoute, async (c) => {
    const submission = await getOwnSubmission(
      c.var.db,
      c.var.session!.user.id,
      c.req.valid("param").id,
    );
    if (!submission) {
      throw new AppError(404, "NOT_FOUND", "Submission not found");
    }
    return c.json(submission, 200);
  })
  .openapi(reclassifyMySubmissionRoute, async (c) =>
    c.json(
      await reclassifyOwnSubmission(
        c.var.db,
        c.env.WATERMARK_QUEUE,
        c.var.session!.user.id,
        c.req.valid("param").id,
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(getMySubmissionFileRoute, async (c) => {
    const object = await getOwnSubmissionFile(
      c.var.db,
      c.env.BUCKET,
      c.var.session!.user.id,
      c.req.valid("param").id,
    );
    if (!object) throw new AppError(404, "NOT_FOUND", "Submission not found");
    // Unpublished papers are private to their uploader: never cache them in shared caches.
    return objectResponse(object, "private, no-store");
  })
  .openapi(withdrawMySubmissionRoute, async (c) => {
    await withdrawSubmission(
      c.var.db,
      c.env.BUCKET,
      c.var.session!.user.id,
      c.req.valid("param").id,
    );
    return c.body(null, 204);
  })
  .openapi(updateUsernameRoute, async (c) =>
    c.json(
      {
        username: await updateUsername(
          c.var.db,
          c.var.session!.user.id,
          c.req.valid("json").username,
        ),
      },
      200,
    ),
  );
