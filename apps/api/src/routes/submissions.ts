import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  createdSubmissionSchema,
  idQuerySchema,
  refineSubmissionFields,
  submissionFieldsSchema,
} from "@ourdiu/shared";
import { AppError, validationHook } from "../lib/errors";
import { objectResponse } from "../lib/files";
import { errorResponse, jsonResponse } from "../lib/openapi";
import { rateLimit } from "../middleware/rate-limit";
import { requireAuth } from "../middleware/require-auth";
import { requireContributor } from "../middleware/require-contributor";
import { getPublishedSubmissionFile } from "../services/questions";
import { createSubmission } from "../services/submissions";
import type { AppEnv } from "../types";

const tags = ["Submissions"];

const createSubmissionRoute = createRoute({
  method: "post",
  path: "/",
  tags,
  summary: "Contribute a question paper (requires sign-in with a DIU email)",
  description:
    "Only accounts on a DIU address (and admins) can contribute. " +
    "Department, course and semester can each be an existing id or a new name. " +
    "Submissions with new names have no question until an admin approves the new values.",
  middleware: [
    requireAuth,
    requireContributor,
    rateLimit(
      "UPLOAD_LIMITER",
      "You're uploading too fast. Please wait a minute and try again.",
    ),
  ] as const,
  request: {
    body: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: submissionFieldsSchema
            .extend({
              file: z
                .instanceof(File, { error: "Choose a PDF file" })
                .openapi({ type: "string", format: "binary" }),
            })
            .superRefine(refineSubmissionFields),
        },
      },
    },
  },
  responses: {
    201: jsonResponse(createdSubmissionSchema, "Submitted for review"),
    400: errorResponse("Invalid file"),
    401: errorResponse("Not signed in"),
    403: errorResponse("Not a DIU email address"),
    422: errorResponse("Invalid fields"),
    429: errorResponse("Too many uploads"),
  },
});

const getSubmissionFileRoute = createRoute({
  method: "get",
  path: "/{id}/file",
  tags,
  summary: "Download the PDF of a published submission",
  request: { params: z.object({ id: idQuerySchema }) },
  responses: {
    200: {
      description: "PDF file",
      content: {
        "application/pdf": {
          schema: z.string().openapi({ format: "binary" }),
        },
      },
    },
    404: errorResponse("Submission not found"),
  },
});

export const submissionRoutes = new OpenAPIHono<AppEnv>({
  defaultHook: validationHook,
})
  .openapi(createSubmissionRoute, async (c) => {
    const { file, ...fields } = c.req.valid("form");
    const created = await createSubmission(
      c.var.db,
      c.env.BUCKET,
      c.env.ANALYSIS_QUEUE,
      {
        fields,
        file,
        uploaderId: c.var.session!.user.id,
      },
    );
    return c.json(created, 201);
  })
  .openapi(getSubmissionFileRoute, async (c) => {
    const file = await getPublishedSubmissionFile(
      c.var.db,
      c.env.BUCKET,
      c.req.valid("param").id,
    );
    if (!file) throw new AppError(404, "NOT_FOUND", "Submission not found");
    // The original stands in only until the watermarked copy is ready.
    return objectResponse(
      file.object,
      file.watermarked ? "public, max-age=86400" : "public, max-age=300",
    );
  });
