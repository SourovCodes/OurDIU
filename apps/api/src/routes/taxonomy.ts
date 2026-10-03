import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  courseListSchema,
  departmentListSchema,
  examTypeListSchema,
  listCoursesQuerySchema,
  mergedIdParamsSchema,
  mergedIdSchema,
  semesterListSchema,
  taxonomySchema,
} from "@ourdiu/shared";
import { validationHook } from "../lib/errors";
import { errorResponse, jsonResponse } from "../lib/openapi";
import {
  getTaxonomy,
  listCourses,
  listDepartments,
  listExamTypes,
  listSemesters,
} from "../services/taxonomy";
import { findMergedId } from "../services/merge";
import type { AppEnv } from "../types";

const tags = ["Taxonomy"];

const getTaxonomyRoute = createRoute({
  method: "get",
  path: "/taxonomy",
  tags,
  summary: "List departments, courses, semesters and exam types at once",
  responses: {
    200: jsonResponse(taxonomySchema, "All four lists, ordered as below"),
  },
});

const listDepartmentsRoute = createRoute({
  method: "get",
  path: "/departments",
  tags,
  summary: "List departments",
  responses: { 200: jsonResponse(departmentListSchema, "Departments") },
});

const listCoursesRoute = createRoute({
  method: "get",
  path: "/courses",
  tags,
  summary: "List courses, optionally for one department",
  request: { query: listCoursesQuerySchema },
  responses: {
    200: jsonResponse(courseListSchema, "Courses"),
    422: errorResponse("Invalid query"),
  },
});

const listSemestersRoute = createRoute({
  method: "get",
  path: "/semesters",
  tags,
  summary: "List semesters",
  responses: { 200: jsonResponse(semesterListSchema, "Semesters") },
});

const listExamTypesRoute = createRoute({
  method: "get",
  path: "/exam-types",
  tags,
  summary: "List exam types",
  responses: { 200: jsonResponse(examTypeListSchema, "Exam types") },
});

const getMergedIdRoute = createRoute({
  method: "get",
  path: "/merged/{kind}/{id}",
  tags,
  summary: "Where a merged entry went",
  description:
    "When admins merge duplicate catalog entries, the removed ones (and questions combined with another) are deleted. " +
    "This returns the id of the entry that was kept, so old links can be redirected.",
  request: { params: mergedIdParamsSchema },
  responses: {
    200: jsonResponse(mergedIdSchema, "The entry that was kept"),
    404: errorResponse("Never merged"),
    422: errorResponse("Invalid kind or id"),
  },
});

export const taxonomyRoutes = new OpenAPIHono<AppEnv>({
  defaultHook: validationHook,
})
  .openapi(getTaxonomyRoute, async (c) =>
    c.json(await getTaxonomy(c.var.db), 200),
  )
  .openapi(listDepartmentsRoute, async (c) =>
    c.json({ items: await listDepartments(c.var.db) }, 200),
  )
  .openapi(listCoursesRoute, async (c) => {
    const { departmentId } = c.req.valid("query");
    return c.json({ items: await listCourses(c.var.db, departmentId) }, 200);
  })
  .openapi(listSemestersRoute, async (c) =>
    c.json({ items: await listSemesters(c.var.db) }, 200),
  )
  .openapi(listExamTypesRoute, async (c) =>
    c.json({ items: await listExamTypes(c.var.db) }, 200),
  )
  .openapi(getMergedIdRoute, async (c) => {
    const { kind, id } = c.req.valid("param");
    return c.json(await findMergedId(c.var.db, kind, id), 200);
  });
