import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { coverPageInputSchema, coverPageTemplateSchema } from "@ourdiu/shared";
import { validationHook } from "../lib/errors";
import { errorResponse } from "../lib/openapi";
import { coverPageFilename, coverPagePdf } from "../services/cover-page/pdf";
import type { AppEnv } from "../types";

// The Cover Page product (docs/PLAN.md, decisions 39 and 40). Public: nothing
// here is stored.

const tags = ["Cover Page"];

const coverPagePdfRoute = createRoute({
  method: "post",
  path: "/{template}/pdf",
  tags,
  summary: "Make a cover page as a PDF",
  description:
    "One A4 page in DIU's format for an assignment, a lab report or a group assignment, from the details sent. Blank details are left blank. Nothing is kept.",
  request: {
    params: z.object({ template: coverPageTemplateSchema }),
    body: {
      required: true,
      content: { "application/json": { schema: coverPageInputSchema } },
    },
  },
  responses: {
    200: {
      description: "PDF file",
      content: {
        "application/pdf": {
          schema: z.string().openapi({ format: "binary" }),
        },
      },
    },
    422: errorResponse("Unknown template, or a detail too long"),
  },
});

export const coverPageRoutes = new OpenAPIHono<AppEnv>({
  defaultHook: validationHook,
}).openapi(coverPagePdfRoute, async (c) => {
  const { template } = c.req.valid("param");
  const values = c.req.valid("json");
  const pdf = await coverPagePdf(template, values);
  return c.body(pdf.slice().buffer, 200, {
    "content-type": "application/pdf",
    "content-disposition": `attachment; filename="${coverPageFilename(template, values.courseCode)}"`,
    "cache-control": "no-store",
  });
});
