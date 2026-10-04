import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  adminRoutineCourseListSchema,
  adminRoutineCourseSchema,
  adminRoutineCatalogQuerySchema,
  adminRoutineTeacherListSchema,
  adminRoutineTeacherSchema,
  adminRoutineVersionDetailSchema,
  adminRoutineVersionListSchema,
  idQuerySchema,
  MAX_ROUTINE_PDF_BYTES,
  routineCourseInputSchema,
  routineCourseParamsSchema,
  routineCoursesRemoveInputSchema,
  routineRemovedSchema,
  routineSectionSchema,
  routineTeacherInputSchema,
  routineTeacherParamsSchema,
  routineTeachersRemoveInputSchema,
  routineVersionInputSchema,
} from "@ourdiu/shared";
import { bodyLimit } from "hono/body-limit";
import { errorBody } from "../lib/errors";
import { objectResponse } from "../lib/files";
import { errorResponse, jsonResponse } from "../lib/openapi";
import { requireAdmin } from "../middleware/require-admin";
import {
  deleteRoutineCourseTitle,
  deleteRoutineTeacher,
  pageRoutineCourses,
  pageRoutineTeachers,
  removeRoutineCourseTitles,
  removeRoutineTeachers,
  setRoutineCourseTitle,
  setRoutineTeacher,
} from "../services/routine/catalog";
import { readRoutinePdf } from "../services/routine/import";
import { sectionOfVersion } from "../services/routine/sections";
import {
  deleteRoutineVersion,
  findVersion,
  getRoutineVersion,
  getRoutineVersionPdf,
  listRoutineVersions,
  makeRoutineVersionLive,
  renumberRoutineVersion,
  uploadRoutineVersion,
} from "../services/routine/versions";
import type { AppEnv } from "../types";

// The Class Routine for admins (/api/v1/admin/routine). DIU's routine PDFs are
// uploaded here and read into drafts; one version per department is live. Course
// titles and teachers' details, which the PDFs lack, are kept per department.

const tags = ["Admin: routine"];
const middleware = requireAdmin;
const denied = {
  401: errorResponse("Not signed in"),
  403: errorResponse("Not an admin"),
};
const params = z.object({ id: idQuerySchema });

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
  summary: "Read DIU's routine PDF into a draft",
  description:
    "Each department's PDF has its own reader (CSE's and EEE's so far), found by the heading on its first page; another PDF is answered with 422 `UNKNOWN_ROUTINE_PDF`. What's read is checked: if the PDF's layout changed so it can't be used, 422 `INVALID_ROUTINE_FILE` with the problems in `details` (`{ path, message }`). Cells that couldn't be read, or were read with a guess, are the draft's first warnings (`unreadable`); possible slips in the routine (clashes, untitled courses) follow.",
  middleware: [
    requireAdmin,
    bodyLimit({
      maxSize: MAX_ROUTINE_PDF_BYTES,
      onError: (c) =>
        c.json(
          errorBody(
            "FILE_TOO_LARGE",
            `The PDF is larger than ${MAX_ROUTINE_PDF_BYTES / 1024 / 1024} MB`,
          ),
          413,
        ),
    }),
  ] as const,
  request: {
    body: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: z.object({
            file: z
              .instanceof(File, { error: "Choose the routine PDF" })
              .openapi({ type: "string", format: "binary" }),
            /** The version number to use instead of the one printed on the PDF. */
            version: routineVersionInputSchema.shape.version.optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: jsonResponse(adminRoutineVersionDetailSchema, "The draft"),
    400: errorResponse("No file"),
    ...denied,
    409: errorResponse("The version is already uploaded"),
    413: errorResponse("The PDF is too large"),
    422: errorResponse("Not a routine PDF OurDIU can read"),
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
    "The department's live version becomes a previous version. A previous version can be made live again. Teachers the PDF lists are added to the department's; for ones already there, only empty details are filled in.",
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
  summary: "Delete a version, with its PDF",
  description:
    "Deleting the live version leaves the department without a routine until another version is made live.",
  middleware,
  request: { params },
  responses: {
    204: { description: "Deleted" },
    ...denied,
    404: errorResponse("Version not found"),
  },
});

const renumberVersionRoute = createRoute({
  method: "patch",
  path: "/versions/{id}",
  tags,
  summary: "Change a version's number",
  description:
    "Students see the new number right away if it's live. A department's numbers are each used once.",
  middleware,
  request: {
    params,
    body: {
      required: true,
      content: { "application/json": { schema: routineVersionInputSchema } },
    },
  },
  responses: {
    200: jsonResponse(adminRoutineVersionDetailSchema, "The version"),
    ...denied,
    404: errorResponse("Version not found"),
    409: errorResponse("The department has a version with that number"),
    422: errorResponse("Invalid number"),
  },
});

const previewSectionRoute = createRoute({
  method: "get",
  path: "/versions/{id}/sections/{section}",
  tags,
  summary: "A section's week in any version, as students would see it",
  description: "For checking a draft before making it live.",
  middleware,
  request: {
    params: params.extend({
      section: z.string().min(1).max(30),
    }),
  },
  responses: {
    200: jsonResponse(routineSectionSchema, "The section's week"),
    ...denied,
    404: errorResponse("No such version or section"),
  },
});

const versionPdfRoute = createRoute({
  method: "get",
  path: "/versions/{id}/pdf",
  tags,
  summary: "Download DIU's PDF a version was read from",
  middleware,
  request: { params },
  responses: {
    200: {
      description: "The PDF",
      content: {
        "application/pdf": {
          schema: z.string().openapi({ format: "binary" }),
        },
      },
    },
    ...denied,
    404: errorResponse("Version not found"),
  },
});

const listCoursesRoute = createRoute({
  method: "get",
  path: "/courses",
  tags,
  summary: "A department's courses and their titles, a page at a time",
  description:
    "The codes in any of the department's versions, and any given a title, by code. `q` searches codes and titles; `missing=true` keeps those without a title.",
  middleware,
  request: { query: adminRoutineCatalogQuerySchema },
  responses: {
    200: jsonResponse(adminRoutineCourseListSchema, "Courses"),
    ...denied,
  },
});

const setCourseRoute = createRoute({
  method: "put",
  path: "/courses/{department}/{code}",
  tags,
  summary: "Give a course its title",
  description: "Students see it right away, in every version.",
  middleware,
  request: {
    params: routineCourseParamsSchema,
    body: {
      required: true,
      content: { "application/json": { schema: routineCourseInputSchema } },
    },
  },
  responses: {
    200: jsonResponse(adminRoutineCourseSchema, "The course"),
    ...denied,
    422: errorResponse("Invalid title"),
  },
});

const deleteCourseRoute = createRoute({
  method: "delete",
  path: "/courses/{department}/{code}",
  tags,
  summary: "Take a course's title away",
  middleware,
  request: { params: routineCourseParamsSchema },
  responses: {
    204: { description: "Removed" },
    ...denied,
  },
});

const removeCoursesRoute = createRoute({
  method: "post",
  path: "/courses/remove",
  tags,
  summary: "Take several courses' titles away",
  middleware,
  request: {
    body: {
      required: true,
      content: {
        "application/json": { schema: routineCoursesRemoveInputSchema },
      },
    },
  },
  responses: {
    200: jsonResponse(routineRemovedSchema, "How many were removed"),
    ...denied,
    422: errorResponse("Invalid list"),
  },
});

const removeTeachersRoute = createRoute({
  method: "post",
  path: "/teachers/remove",
  tags,
  summary: "Forget several teachers' details",
  middleware,
  request: {
    body: {
      required: true,
      content: {
        "application/json": { schema: routineTeachersRemoveInputSchema },
      },
    },
  },
  responses: {
    200: jsonResponse(routineRemovedSchema, "How many were removed"),
    ...denied,
    422: errorResponse("Invalid list"),
  },
});

const listTeachersRoute = createRoute({
  method: "get",
  path: "/teachers",
  tags,
  summary: "A department's teachers and their details, a page at a time",
  description:
    "The initials in any of the department's versions, and any added by hand, by initials. `q` searches initials, names, rooms, emails, phones and course codes; `missing=true` keeps those without a name.",
  middleware,
  request: { query: adminRoutineCatalogQuerySchema },
  responses: {
    200: jsonResponse(adminRoutineTeacherListSchema, "Teachers"),
    ...denied,
  },
});

const setTeacherRoute = createRoute({
  method: "put",
  path: "/teachers/{department}/{initials}",
  tags,
  summary: "Set a teacher's name, phone, email and room",
  description:
    "Replaces what's there: a field left out is cleared. Students see it right away.",
  middleware,
  request: {
    params: routineTeacherParamsSchema,
    body: {
      required: true,
      content: { "application/json": { schema: routineTeacherInputSchema } },
    },
  },
  responses: {
    200: jsonResponse(adminRoutineTeacherSchema, "The teacher"),
    ...denied,
    422: errorResponse("Invalid details"),
  },
});

const deleteTeacherRoute = createRoute({
  method: "delete",
  path: "/teachers/{department}/{initials}",
  tags,
  summary: "Forget a teacher's details",
  middleware,
  request: { params: routineTeacherParamsSchema },
  responses: {
    204: { description: "Removed" },
    ...denied,
  },
});

export const adminRoutineRoutes = new OpenAPIHono<AppEnv>()
  .openapi(listVersionsRoute, async (c) =>
    c.json({ items: await listRoutineVersions(c.var.db) }, 200),
  )
  .openapi(uploadVersionRoute, async (c) => {
    const { file, version } = c.req.valid("form");
    const pdf = new Uint8Array(await file.arrayBuffer());
    return c.json(
      await uploadRoutineVersion(
        c.var.db,
        c.env.BUCKET,
        c.var.session!.user.id,
        await readRoutinePdf(pdf, { version }),
        pdf,
      ),
      201,
    );
  })
  .openapi(getVersionRoute, async (c) =>
    c.json(await getRoutineVersion(c.var.db, c.req.valid("param").id), 200),
  )
  .openapi(makeLiveRoute, async (c) =>
    c.json(
      await makeRoutineVersionLive(c.var.db, c.req.valid("param").id),
      200,
    ),
  )
  .openapi(renumberVersionRoute, async (c) =>
    c.json(
      await renumberRoutineVersion(
        c.var.db,
        c.req.valid("param").id,
        c.req.valid("json").version,
      ),
      200,
    ),
  )
  .openapi(deleteVersionRoute, async (c) => {
    await deleteRoutineVersion(c.var.db, c.env.BUCKET, c.req.valid("param").id);
    return c.body(null, 204);
  })
  .openapi(previewSectionRoute, async (c) => {
    const { id, section } = c.req.valid("param");
    return c.json(
      await sectionOfVersion(
        c.var.db,
        await findVersion(c.var.db, id),
        section,
      ),
      200,
    );
  })
  .openapi(versionPdfRoute, async (c) => {
    const { object, filename } = await getRoutineVersionPdf(
      c.var.db,
      c.env.BUCKET,
      c.req.valid("param").id,
    );
    const res = objectResponse(object, "private, no-store");
    res.headers.set(
      "content-disposition",
      `attachment; filename="${filename}"`,
    );
    // Streamed as stored, not through c.json, so the route's typing can't see it.
    return res as never;
  })
  .openapi(listCoursesRoute, async (c) =>
    c.json(await pageRoutineCourses(c.var.db, c.req.valid("query")), 200),
  )
  .openapi(removeCoursesRoute, async (c) => {
    const { department, codes } = c.req.valid("json");
    return c.json(
      { removed: await removeRoutineCourseTitles(c.var.db, department, codes) },
      200,
    );
  })
  .openapi(setCourseRoute, async (c) => {
    const { department, code } = c.req.valid("param");
    return c.json(
      await setRoutineCourseTitle(
        c.var.db,
        department,
        code,
        c.req.valid("json").title,
      ),
      200,
    );
  })
  .openapi(deleteCourseRoute, async (c) => {
    const { department, code } = c.req.valid("param");
    await deleteRoutineCourseTitle(c.var.db, department, code);
    return c.body(null, 204);
  })
  .openapi(listTeachersRoute, async (c) =>
    c.json(await pageRoutineTeachers(c.var.db, c.req.valid("query")), 200),
  )
  .openapi(removeTeachersRoute, async (c) => {
    const { department, initials } = c.req.valid("json");
    return c.json(
      { removed: await removeRoutineTeachers(c.var.db, department, initials) },
      200,
    );
  })
  .openapi(setTeacherRoute, async (c) => {
    const { department, initials } = c.req.valid("param");
    return c.json(
      await setRoutineTeacher(
        c.var.db,
        department,
        initials,
        c.req.valid("json"),
      ),
      200,
    );
  })
  .openapi(deleteTeacherRoute, async (c) => {
    const { department, initials } = c.req.valid("param");
    await deleteRoutineTeacher(c.var.db, department, initials);
    return c.body(null, 204);
  });
