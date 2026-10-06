import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { coverPageInputSchema, coverPageTemplateSchema } from "@ourdiu/shared";
import { validationHook } from "../lib/errors";
import { errorResponse } from "../lib/openapi";
import {
  coverPageDocx,
  coverPageDocxFilename,
} from "../services/cover-page/docx";
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
    "One A4 page in DIU's format (a cover for an assignment, lab report, group assignment, final lab report, presentation or project report; a lab report index; or a title page for an internship report or final-year project), from the details sent. Blank details are left blank. Nothing is kept.",
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

const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const coverPageDocxRoute = createRoute({
  method: "post",
  path: "/{template}/docx",
  tags,
  summary: "Make a cover page as a Word document",
  description:
    "The same page as the PDF, as a .docx to edit in Word or Google Docs. It keeps any script (Bangla too), which the PDF can't. Nothing is kept.",
  request: {
    params: z.object({ template: coverPageTemplateSchema }),
    body: {
      required: true,
      content: { "application/json": { schema: coverPageInputSchema } },
    },
  },
  responses: {
    200: {
      description: "Word document",
      content: { [DOCX]: { schema: z.string().openapi({ format: "binary" }) } },
    },
    422: errorResponse("Unknown template, or a detail too long"),
  },
});

export const coverPageRoutes = new OpenAPIHono<AppEnv>({
  defaultHook: validationHook,
})
  .openapi(coverPagePdfRoute, async (c) => {
    const { template } = c.req.valid("param");
    const values = c.req.valid("json");
    const pdf = await coverPagePdf(template, values);
    return c.body(pdf.slice().buffer, 200, {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${coverPageFilename(template, values.courseCode)}"`,
      "cache-control": "no-store",
    });
  })
  .openapi(coverPageDocxRoute, async (c) => {
    const { template } = c.req.valid("param");
    const values = c.req.valid("json");
    return c.body(await coverPageDocx(template, values), 200, {
      "content-type": DOCX,
      "content-disposition": `attachment; filename="${coverPageDocxFilename(template, values.courseCode)}"`,
      "cache-control": "no-store",
    });
  });
