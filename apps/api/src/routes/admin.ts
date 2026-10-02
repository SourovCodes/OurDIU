import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  adminCatalogSchema,
  adminCourseSchema,
  adminDepartmentSchema,
  adminExamTypeSchema,
  adminReportListSchema,
  adminReportSchema,
  adminSemesterSchema,
  adminStatsSchema,
  adminSubmissionDetailSchema,
  adminSubmissionListSchema,
  adminSubmissionSchema,
  adminUserListSchema,
  adminUserSchema,
  classifySubmissionInputSchema,
  createCourseInputSchema,
  departmentInputSchema,
  idQuerySchema,
  listAdminReportsQuerySchema,
  listAdminSubmissionsQuerySchema,
  listAdminUsersQuerySchema,
  nameInputSchema,
  semesterInputSchema,
  submissionAnalysisSchema,
  updateReportStatusInputSchema,
  updateSubmissionStatusInputSchema,
  updateUserRoleInputSchema,
  updateUsernameInputSchema,
  USERNAME_RULES,
  submissionWatermarkSchema,
  checksQueuedSchema,
  watermarkQueuedSchema,
} from "@ourdiu/shared";
import { AppError, validationHook } from "../lib/errors";
import { objectResponse } from "../lib/files";
import { errorResponse, jsonResponse } from "../lib/openapi";
import { requireAdmin } from "../middleware/require-admin";
import { getAdminStats } from "../services/admin-stats";
import { checkUnchecked, rerunAnalysis } from "../services/analysis";
import * as catalog from "../services/catalog";
import {
  classifySubmission,
  deleteSubmission,
  getAdminSubmission,
  getAdminSubmissionFile,
  listAdminReports,
  listAdminSubmissions,
  updateReportStatus,
  updateSubmissionStatus,
} from "../services/moderation";
import { updateUsername } from "../services/account";
import { listAdminUsers, updateUserRole } from "../services/users";
import {
  rewatermark,
  rewatermarkAll,
  watermarkMissing,
} from "../services/watermark";
import type { AppEnv } from "../types";

// Every route here is for admins only.
const middleware = requireAdmin;
const denied = {
  401: errorResponse("Not signed in"),
  403: errorResponse("Not an admin"),
};

const userIdParams = z.object({ id: z.string().min(1) });
const numericIdParams = z.object({ id: idQuerySchema });

function jsonBody<T extends z.ZodType>(schema: T) {
  return {
    body: { required: true, content: { "application/json": { schema } } },
  };
}

// ── Dashboard ────────────────────────────────────────────────────────────────

const statsRoute = createRoute({
  method: "get",
  path: "/stats",
  tags: ["Admin"],
  summary: "Headline numbers for the admin dashboard",
  middleware,
  responses: {
    200: jsonResponse(adminStatsSchema, "Dashboard numbers"),
    ...denied,
  },
});

// ── Submissions ──────────────────────────────────────────────────────────────

const submissionTags = ["Admin: submissions"];

const listSubmissionsRoute = createRoute({
  method: "get",
  path: "/submissions",
  tags: submissionTags,
  summary: "List submissions in any status, the most reported first",
  middleware,
  request: { query: listAdminSubmissionsQuerySchema },
  responses: {
    200: jsonResponse(adminSubmissionListSchema, "Submissions"),
    ...denied,
    422: errorResponse("Invalid query"),
  },
});

const getSubmissionRoute = createRoute({
  method: "get",
  path: "/submissions/{id}",
  tags: submissionTags,
  summary: "Get a submission with its reports",
  middleware,
  request: { params: numericIdParams },
  responses: {
    200: jsonResponse(adminSubmissionDetailSchema, "Submission"),
    ...denied,
    404: errorResponse("Submission not found"),
  },
});

const getSubmissionFileRoute = createRoute({
  method: "get",
  path: "/submissions/{id}/file",
  tags: submissionTags,
  summary: "Download the PDF of a submission in any status",
  middleware,
  request: { params: numericIdParams },
  responses: {
    200: {
      description: "PDF file",
      content: {
        "application/pdf": {
          schema: z.string().openapi({ format: "binary" }),
        },
      },
    },
    ...denied,
    404: errorResponse("Submission not found"),
  },
});

const updateSubmissionStatusRoute = createRoute({
  method: "patch",
  path: "/submissions/{id}",
  tags: submissionTags,
  summary: "Publish, reject or re-queue a submission",
  description:
    "A submission that proposes new catalog entries has to be classified before it can be published.",
  middleware,
  request: {
    params: numericIdParams,
    ...jsonBody(updateSubmissionStatusInputSchema),
  },
  responses: {
    200: jsonResponse(adminSubmissionSchema, "Updated submission"),
    ...denied,
    404: errorResponse("Submission not found"),
    409: errorResponse("Needs classification before publishing"),
    422: errorResponse("Invalid status"),
  },
});

const classifySubmissionRoute = createRoute({
  method: "put",
  path: "/submissions/{id}/classification",
  tags: submissionTags,
  summary:
    "File a submission under a department, course, semester and exam type",
  description:
    "Each of department, course and semester is an existing id or a new name, which is created. " +
    "Use it to approve a proposal or to correct a paper's details. The status doesn't change.",
  middleware,
  request: {
    params: numericIdParams,
    ...jsonBody(classifySubmissionInputSchema),
  },
  responses: {
    200: jsonResponse(adminSubmissionSchema, "Reclassified submission"),
    ...denied,
    404: errorResponse("Submission not found"),
    409: errorResponse("A new name clashes with an existing entry"),
    422: errorResponse("Invalid classification"),
  },
});

const analyzeSubmissionRoute = createRoute({
  method: "post",
  path: "/submissions/{id}/analysis",
  tags: submissionTags,
  summary: "Run the AI analysis of a submission again",
  description:
    "Queues a new run (compress the PDF, ask Gemini) and clears the previous result.",
  middleware,
  request: { params: numericIdParams },
  responses: {
    202: jsonResponse(submissionAnalysisSchema, "Analysis queued"),
    ...denied,
    404: errorResponse("Submission not found"),
  },
});

const checkUncheckedRoute = createRoute({
  method: "post",
  path: "/submissions/analysis",
  tags: submissionTags,
  summary: "Run the AI check on pending papers that were never checked",
  description:
    "Runs the upload check (which publishes papers it confirms) on up to 100 pending papers without an analysis, such as imported ones. Call again for the rest.",
  middleware,
  responses: {
    202: jsonResponse(checksQueuedSchema, "Papers queued"),
    ...denied,
  },
});

const watermarkMissingRoute = createRoute({
  method: "post",
  path: "/submissions/watermark",
  tags: submissionTags,
  summary: "Watermark every published paper that has no watermarked copy",
  description:
    "Queues published papers that were never watermarked or whose watermark failed. Until a copy is ready, the public downloads the original.",
  middleware,
  responses: {
    202: jsonResponse(watermarkQueuedSchema, "Papers queued"),
    ...denied,
  },
});

const rewatermarkAllRoute = createRoute({
  method: "post",
  path: "/submissions/watermark/all",
  tags: submissionTags,
  summary: "Make every published paper's watermarked copy again",
  description:
    "E.g. after the watermark changed. Current copies are served until their replacements are ready.",
  middleware,
  responses: {
    202: jsonResponse(watermarkQueuedSchema, "Papers queued"),
    ...denied,
  },
});

const rewatermarkSubmissionRoute = createRoute({
  method: "post",
  path: "/submissions/{id}/watermark",
  tags: submissionTags,
  summary: "Make the watermarked copy of a published paper again",
  description:
    "E.g. after the contributor changed their name. The current copy is served until the new one is ready.",
  middleware,
  request: { params: numericIdParams },
  responses: {
    202: jsonResponse(submissionWatermarkSchema, "Watermark queued"),
    ...denied,
    404: errorResponse("Submission not found"),
    409: errorResponse("The submission isn't published"),
  },
});

const deleteSubmissionRoute = createRoute({
  method: "delete",
  path: "/submissions/{id}",
  tags: submissionTags,
  summary: "Delete a submission in any status, with its PDF",
  middleware,
  request: { params: numericIdParams },
  responses: {
    204: { description: "Deleted" },
    ...denied,
    404: errorResponse("Submission not found"),
  },
});

// ── Reports ──────────────────────────────────────────────────────────────────

const reportTags = ["Admin: reports"];

const listReportsRoute = createRoute({
  method: "get",
  path: "/reports",
  tags: reportTags,
  summary: "List reports, newest first",
  middleware,
  request: { query: listAdminReportsQuerySchema },
  responses: {
    200: jsonResponse(adminReportListSchema, "Reports"),
    ...denied,
    422: errorResponse("Invalid query"),
  },
});

const updateReportRoute = createRoute({
  method: "patch",
  path: "/reports/{id}",
  tags: reportTags,
  summary: "Resolve, dismiss or reopen a report",
  description:
    "The paper's status doesn't change: publish a hidden paper again separately.",
  middleware,
  request: {
    params: numericIdParams,
    ...jsonBody(updateReportStatusInputSchema),
  },
  responses: {
    200: jsonResponse(adminReportSchema, "Updated report"),
    ...denied,
    404: errorResponse("Report not found"),
    409: errorResponse("The reporter already has an open report on the paper"),
    422: errorResponse("Invalid status"),
  },
});

// ── Catalog ──────────────────────────────────────────────────────────────────

const catalogTags = ["Admin: catalog"];

const getCatalogRoute = createRoute({
  method: "get",
  path: "/catalog",
  tags: catalogTags,
  summary: "Departments, courses, semesters and exam types with their usage",
  middleware,
  responses: {
    200: jsonResponse(adminCatalogSchema, "Catalog"),
    ...denied,
  },
});

/** Create, update and delete routes for one kind of catalog entry. */
function catalogRoutes<
  C extends z.ZodType,
  U extends z.ZodType,
  R extends z.ZodType,
>(path: string, label: string, schemas: { create: C; update: U; result: R }) {
  const conflict = errorResponse(`A ${label} with this name already exists`);
  return {
    create: createRoute({
      method: "post",
      path: `/${path}`,
      tags: catalogTags,
      summary: `Create a ${label}`,
      middleware,
      request: jsonBody(schemas.create),
      responses: {
        201: jsonResponse(schemas.result, `Created ${label}`),
        ...denied,
        409: conflict,
        422: errorResponse("Invalid fields"),
      },
    }),
    update: createRoute({
      method: "patch",
      path: `/${path}/{id}`,
      tags: catalogTags,
      summary: `Rename a ${label}`,
      middleware,
      request: { params: numericIdParams, ...jsonBody(schemas.update) },
      responses: {
        200: jsonResponse(schemas.result, `Updated ${label}`),
        ...denied,
        404: errorResponse(`${label} not found`),
        409: conflict,
        422: errorResponse("Invalid fields"),
      },
    }),
    remove: createRoute({
      method: "delete",
      path: `/${path}/{id}`,
      tags: catalogTags,
      summary: `Delete an unused ${label}`,
      middleware,
      request: { params: numericIdParams },
      responses: {
        204: { description: "Deleted" },
        ...denied,
        404: errorResponse(`${label} not found`),
        409: errorResponse(`The ${label} is still in use`),
      },
    }),
  };
}

const departmentRoutes = catalogRoutes("departments", "department", {
  create: departmentInputSchema,
  update: departmentInputSchema,
  result: adminDepartmentSchema,
});
const courseRoutes = catalogRoutes("courses", "course", {
  create: createCourseInputSchema,
  update: nameInputSchema,
  result: adminCourseSchema,
});
const semesterRoutes = catalogRoutes("semesters", "semester", {
  create: semesterInputSchema,
  update: semesterInputSchema,
  result: adminSemesterSchema,
});
const examTypeRoutes = catalogRoutes("exam-types", "exam type", {
  create: nameInputSchema,
  update: nameInputSchema,
  result: adminExamTypeSchema,
});

// ── Users ────────────────────────────────────────────────────────────────────

const userTags = ["Admin: users"];

const listUsersRoute = createRoute({
  method: "get",
  path: "/users",
  tags: userTags,
  summary: "List users, newest first",
  middleware,
  request: { query: listAdminUsersQuerySchema },
  responses: {
    200: jsonResponse(adminUserListSchema, "Users"),
    ...denied,
    422: errorResponse("Invalid query"),
  },
});

const updateUserRoleRoute = createRoute({
  method: "patch",
  path: "/users/{id}",
  tags: userTags,
  summary: "Grant or remove admin rights",
  middleware,
  request: { params: userIdParams, ...jsonBody(updateUserRoleInputSchema) },
  responses: {
    200: jsonResponse(adminUserSchema, "Updated user"),
    ...denied,
    404: errorResponse("User not found"),
    409: errorResponse("Admins can't change their own role"),
    422: errorResponse("Invalid role"),
  },
});

const updateUserUsernameRoute = createRoute({
  method: "put",
  path: "/users/{id}/username",
  tags: userTags,
  summary: "Change a user's username",
  description: `Same rules as changing your own: ${USERNAME_RULES}; saved in lowercase.`,
  middleware,
  request: { params: userIdParams, ...jsonBody(updateUsernameInputSchema) },
  responses: {
    200: jsonResponse(updateUsernameInputSchema, "Their new username"),
    ...denied,
    404: errorResponse("User not found"),
    409: errorResponse("Someone else already has that username"),
    422: errorResponse("Not a valid username"),
  },
});

export const adminRoutes = new OpenAPIHono<AppEnv>({
  defaultHook: validationHook,
})
  .openapi(statsRoute, async (c) => c.json(await getAdminStats(c.var.db), 200))

  .openapi(listSubmissionsRoute, async (c) =>
    c.json(await listAdminSubmissions(c.var.db, c.req.valid("query")), 200),
  )
  .openapi(getSubmissionRoute, async (c) => {
    const submission = await getAdminSubmission(
      c.var.db,
      c.req.valid("param").id,
    );
    if (!submission) {
      throw new AppError(404, "NOT_FOUND", "Submission not found");
    }
    return c.json(submission, 200);
  })
  .openapi(getSubmissionFileRoute, async (c) => {
    const object = await getAdminSubmissionFile(
      c.var.db,
      c.env.BUCKET,
      c.req.valid("param").id,
    );
    if (!object) throw new AppError(404, "NOT_FOUND", "Submission not found");
    // Unpublished papers are private: never cache them in shared caches.
    return objectResponse(object, "private, no-store");
  })
  .openapi(updateSubmissionStatusRoute, async (c) =>
    c.json(
      await updateSubmissionStatus(
        c.var.db,
        c.env.WATERMARK_QUEUE,
        c.req.valid("param").id,
        c.req.valid("json").status,
        c.req.valid("json").reason,
      ),
      200,
    ),
  )
  .openapi(classifySubmissionRoute, async (c) =>
    c.json(
      await classifySubmission(
        c.var.db,
        c.req.valid("param").id,
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(analyzeSubmissionRoute, async (c) =>
    c.json(
      await rerunAnalysis(
        c.var.db,
        c.env.ANALYSIS_QUEUE,
        c.req.valid("param").id,
      ),
      202,
    ),
  )
  .openapi(checkUncheckedRoute, async (c) =>
    c.json(
      { queued: await checkUnchecked(c.var.db, c.env.ANALYSIS_QUEUE) },
      202,
    ),
  )
  .openapi(watermarkMissingRoute, async (c) =>
    c.json(
      { queued: await watermarkMissing(c.var.db, c.env.WATERMARK_QUEUE) },
      202,
    ),
  )
  .openapi(rewatermarkAllRoute, async (c) =>
    c.json(
      { queued: await rewatermarkAll(c.var.db, c.env.WATERMARK_QUEUE) },
      202,
    ),
  )
  .openapi(rewatermarkSubmissionRoute, async (c) =>
    c.json(
      await rewatermark(
        c.var.db,
        c.env.WATERMARK_QUEUE,
        c.req.valid("param").id,
      ),
      202,
    ),
  )
  .openapi(deleteSubmissionRoute, async (c) => {
    await deleteSubmission(c.var.db, c.env.BUCKET, c.req.valid("param").id);
    return c.body(null, 204);
  })

  .openapi(listReportsRoute, async (c) =>
    c.json(await listAdminReports(c.var.db, c.req.valid("query")), 200),
  )
  .openapi(updateReportRoute, async (c) =>
    c.json(
      await updateReportStatus(
        c.var.db,
        c.req.valid("param").id,
        c.req.valid("json").status,
      ),
      200,
    ),
  )

  .openapi(getCatalogRoute, async (c) =>
    c.json(await catalog.getCatalog(c.var.db), 200),
  )
  .openapi(departmentRoutes.create, async (c) =>
    c.json(await catalog.createDepartment(c.var.db, c.req.valid("json")), 201),
  )
  .openapi(departmentRoutes.update, async (c) =>
    c.json(
      await catalog.updateDepartment(
        c.var.db,
        c.req.valid("param").id,
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(departmentRoutes.remove, async (c) => {
    await catalog.deleteDepartment(c.var.db, c.req.valid("param").id);
    return c.body(null, 204);
  })
  .openapi(courseRoutes.create, async (c) =>
    c.json(await catalog.createCourse(c.var.db, c.req.valid("json")), 201),
  )
  .openapi(courseRoutes.update, async (c) =>
    c.json(
      await catalog.renameCourse(
        c.var.db,
        c.req.valid("param").id,
        c.req.valid("json").name,
      ),
      200,
    ),
  )
  .openapi(courseRoutes.remove, async (c) => {
    await catalog.deleteCourse(c.var.db, c.req.valid("param").id);
    return c.body(null, 204);
  })
  .openapi(semesterRoutes.create, async (c) =>
    c.json(
      await catalog.createSemester(c.var.db, c.req.valid("json").name),
      201,
    ),
  )
  .openapi(semesterRoutes.update, async (c) =>
    c.json(
      await catalog.renameSemester(
        c.var.db,
        c.req.valid("param").id,
        c.req.valid("json").name,
      ),
      200,
    ),
  )
  .openapi(semesterRoutes.remove, async (c) => {
    await catalog.deleteSemester(c.var.db, c.req.valid("param").id);
    return c.body(null, 204);
  })
  .openapi(examTypeRoutes.create, async (c) =>
    c.json(
      await catalog.createExamType(c.var.db, c.req.valid("json").name),
      201,
    ),
  )
  .openapi(examTypeRoutes.update, async (c) =>
    c.json(
      await catalog.renameExamType(
        c.var.db,
        c.req.valid("param").id,
        c.req.valid("json").name,
      ),
      200,
    ),
  )
  .openapi(examTypeRoutes.remove, async (c) => {
    await catalog.deleteExamType(c.var.db, c.req.valid("param").id);
    return c.body(null, 204);
  })

  .openapi(listUsersRoute, async (c) =>
    c.json(await listAdminUsers(c.var.db, c.req.valid("query")), 200),
  )
  .openapi(updateUserRoleRoute, async (c) =>
    c.json(
      await updateUserRole(
        c.var.db,
        c.var.session!.user.id,
        c.req.valid("param").id,
        c.req.valid("json").role,
      ),
      200,
    ),
  )
  .openapi(updateUserUsernameRoute, async (c) =>
    c.json(
      {
        username: await updateUsername(
          c.var.db,
          c.req.valid("param").id,
          c.req.valid("json").username,
        ),
      },
      200,
    ),
  );
