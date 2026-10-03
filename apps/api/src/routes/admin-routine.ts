import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  adminRoutineVersionDetailSchema,
  adminRoutineVersionListSchema,
  idQuerySchema,
  MAX_ROUTINE_FILE_BYTES,
  routineFilePath,
  routineFileSchema,
  type RoutineFileProblem,
} from "@ourdiu/shared";
import { bodyLimit } from "hono/body-limit";
import { errorBody } from "../lib/errors";
import { objectResponse } from "../lib/files";
import { errorResponse, jsonResponse } from "../lib/openapi";
import { requireAdmin } from "../middleware/require-admin";
import {
  deleteRoutineVersion,
  getRoutineVersion,
  getRoutineVersionFile,
  listRoutineVersions,
  makeRoutineVersionLive,
  uploadRoutineVersion,
} from "../services/routine/versions";
import type { AppEnv } from "../types";

// Routine versions for admins (/api/v1/admin/routine). Routines are turned from DIU's
// PDF into a JSON file outside OurDIU and uploaded here as drafts; one version per
// department is live.

const tags = ["Admin: routine"];
const middleware = requireAdmin;
const denied = {
  401: errorResponse("Not signed in"),
  403: errorResponse("Not an admin"),
};
const params = z.object({ id: idQuerySchema });

/** At most this many problems are listed when a file can't be used. */
const MAX_PROBLEMS = 50;

const listVersionsRoute = createRoute({
  method: "get",
  path: "/versions",
  tags,
  summary: "List routine versions, newest first",
  middleware,
  responses: {
    200: jsonResponse(adminRoutineVersionListSchema, "Versions"),
    ...denied,
  },
});

const uploadVersionRoute = createRoute({
  method: "post",
  path: "/versions",
  tags,
  summary: "Upload a routine file as a draft",
  description:
    "The body is the routine file (`RoutineFile`). A file that can't be used is answered with 422 `INVALID_ROUTINE_FILE` and its problems in `details` (`{ path, message }`). Possible slips (clashes, untitled courses) don't stop the upload: they're the draft's `warnings`.",
  middleware: [
    requireAdmin,
    bodyLimit({
      maxSize: MAX_ROUTINE_FILE_BYTES,
      onError: (c) =>
        c.json(
          errorBody(
            "FILE_TOO_LARGE",
            `The file is larger than ${MAX_ROUTINE_FILE_BYTES / 1024 / 1024} MB`,
          ),
          413,
        ),
    }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: routineFileSchema } },
    },
  },
  responses: {
    201: jsonResponse(adminRoutineVersionDetailSchema, "The draft"),
    ...denied,
    409: errorResponse("The version is already uploaded"),
    413: errorResponse("The file is too large"),
    422: errorResponse("The file can't be used"),
  },
});

const getVersionRoute = createRoute({
  method: "get",
  path: "/versions/{id}",
  tags,
  summary: "A version with its warnings and changes",
  description:
    "Changes are counted against the live version (for a live version, the one it replaced).",
  middleware,
  request: { params },
  responses: {
    200: jsonResponse(adminRoutineVersionDetailSchema, "The version"),
    ...denied,
    404: errorResponse("Version not found"),
  },
});

const makeLiveRoute = createRoute({
  method: "post",
  path: "/versions/{id}/live",
  tags,
  summary: "Make a version the one students see",
  description:
    "The department's live version becomes a previous version. A previous version can be made live again.",
  middleware,
  request: { params },
  responses: {
    200: jsonResponse(adminRoutineVersionDetailSchema, "The live version"),
    ...denied,
    404: errorResponse("Version not found"),
  },
});

const deleteVersionRoute = createRoute({
  method: "delete",
  path: "/versions/{id}",
  tags,
  summary: "Delete a draft",
  middleware,
  request: { params },
  responses: {
    204: { description: "Deleted" },
    ...denied,
    404: errorResponse("Version not found"),
    409: errorResponse("Not a draft"),
  },
});

const versionFileRoute = createRoute({
  method: "get",
  path: "/versions/{id}/file",
  tags,
  summary: "Download the file a version was uploaded as",
  middleware,
  request: { params },
  responses: {
    200: {
      description: "The routine file",
      content: { "application/json": { schema: routineFileSchema } },
    },
    ...denied,
    404: errorResponse("Version not found"),
  },
});

export const adminRoutineRoutes = new OpenAPIHono<AppEnv>()
  .openapi(listVersionsRoute, async (c) =>
    c.json({ items: await listRoutineVersions(c.var.db) }, 200),
  )
  .openapi(
    uploadVersionRoute,
    async (c) =>
      c.json(
        await uploadRoutineVersion(
          c.var.db,
          c.env.BUCKET,
          c.var.session!.user.id,
          c.req.valid("json"),
          await c.req.text(),
        ),
        201,
      ),
    (result, c) => {
      if (result.success) return;
      const problems: RoutineFileProblem[] = result.error.issues
        .slice(0, MAX_PROBLEMS)
        .map((issue) => ({
          path: routineFilePath(issue.path),
          message: issue.message,
        }));
      const total = result.error.issues.length;
      return c.json(
        errorBody(
          "INVALID_ROUTINE_FILE",
          `The file can't be used: ${total} problem${total === 1 ? "" : "s"}`,
          problems,
        ),
        422,
      );
    },
  )
  .openapi(getVersionRoute, async (c) =>
    c.json(await getRoutineVersion(c.var.db, c.req.valid("param").id), 200),
  )
  .openapi(makeLiveRoute, async (c) =>
    c.json(
      await makeRoutineVersionLive(c.var.db, c.req.valid("param").id),
      200,
    ),
  )
  .openapi(deleteVersionRoute, async (c) => {
    await deleteRoutineVersion(c.var.db, c.env.BUCKET, c.req.valid("param").id);
    return c.body(null, 204);
  })
  .openapi(versionFileRoute, async (c) => {
    const { object, filename } = await getRoutineVersionFile(
      c.var.db,
      c.env.BUCKET,
      c.req.valid("param").id,
    );
    const res = objectResponse(object, "private, no-store");
    res.headers.set(
      "content-disposition",
      `attachment; filename="${filename}"`,
    );
    // Streamed as stored, not through c.json, so the route's JSON typing can't see it.
    return res as never;
  });
