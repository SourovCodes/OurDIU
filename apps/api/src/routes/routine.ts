import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  routineDepartmentParamSchema,
  routinePdfQuerySchema,
  routineSectionListSchema,
  routineSectionParamsSchema,
  routineSectionSchema,
  routineSectionSlug,
  routineTeacherListSchema,
  routineTeacherWeekParamsSchema,
  routineTeacherWeekSchema,
  type RoutineDepartment,
} from "@ourdiu/shared";
import { AppError } from "../lib/errors";
import { errorResponse, jsonResponse } from "../lib/openapi";
import {
  routinePdf,
  routinePdfFilename,
  teacherPdfFilename,
  teacherRoutinePdf,
} from "../services/routine/pdf";
import {
  getRoutineSection,
  listRoutineSections,
} from "../services/routine/sections";
import {
  getRoutineTeacherWeek,
  listRoutineTeacherSummaries,
} from "../services/routine/teachers";
import type { AppEnv } from "../types";

// The Class Routine for students: the live version of a department's routine.

const tags = ["Routine"];

const department = (slug: string) => slug.toUpperCase() as RoutineDepartment;

const listSectionsRoute = createRoute({
  method: "get",
  path: "/{department}/sections",
  tags,
  summary: "Every section in a department's live routine",
  description: "With each section's lab groups, for finding your section.",
  request: { params: routineDepartmentParamSchema },
  responses: {
    200: jsonResponse(routineSectionListSchema, "Sections"),
    404: errorResponse("The department has no live routine"),
  },
});

const getSectionRoute = createRoute({
  method: "get",
  path: "/{department}/sections/{section}",
  tags,
  summary: "A section's week in the live routine",
  description:
    "Every class of the section, including each lab group's labs, in day and time order. The section is matched regardless of case.",
  request: { params: routineSectionParamsSchema },
  responses: {
    200: jsonResponse(routineSectionSchema, "The section's week"),
    404: errorResponse("No live routine, or no such section"),
  },
});

const sectionPdfRoute = createRoute({
  method: "get",
  path: "/{department}/sections/{section}/pdf",
  tags,
  summary: "A section's week as a PDF",
  description:
    "One A4 page: each day's classes with course, time, room and teacher, the routine's version and a QR code to the section's page. With `group`, only that lab group's labs.",
  request: { params: routineSectionParamsSchema, query: routinePdfQuerySchema },
  responses: {
    200: {
      description: "PDF file",
      content: {
        "application/pdf": {
          schema: z.string().openapi({ format: "binary" }),
        },
      },
    },
    404: errorResponse("No live routine, no such section or lab group"),
  },
});

const listTeachersRoute = createRoute({
  method: "get",
  path: "/{department}/teachers",
  tags,
  summary: "Every teacher in a department's live routine",
  description:
    "Initials, the name where admins added it, and the courses they teach: for finding a teacher's week.",
  request: { params: routineDepartmentParamSchema },
  responses: {
    200: jsonResponse(routineTeacherListSchema, "Teachers"),
    404: errorResponse("The department has no live routine"),
  },
});

const getTeacherRoute = createRoute({
  method: "get",
  path: "/{department}/teachers/{initials}",
  tags,
  summary: "A teacher's week in the live routine",
  description:
    "Every class the teacher has, with the sections attending, in day and time order. Sections sharing a class are one class. The initials are matched regardless of case.",
  request: { params: routineTeacherWeekParamsSchema },
  responses: {
    200: jsonResponse(routineTeacherWeekSchema, "The teacher's week"),
    404: errorResponse("No live routine, or no such teacher"),
  },
});

const teacherPdfRoute = createRoute({
  method: "get",
  path: "/{department}/teachers/{initials}/pdf",
  tags,
  summary: "A teacher's week as a PDF",
  description:
    "One A4 page: each day's classes with course, time, room and sections, the routine's version and a QR code to the teacher's page.",
  request: { params: routineTeacherWeekParamsSchema },
  responses: {
    200: {
      description: "PDF file",
      content: {
        "application/pdf": {
          schema: z.string().openapi({ format: "binary" }),
        },
      },
    },
    404: errorResponse("No live routine, or no such teacher"),
  },
});

/** Today's date in Dhaka, "2026-10-04". */
const dhakaToday = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });

export const routineRoutes = new OpenAPIHono<AppEnv>()
  .openapi(listSectionsRoute, async (c) =>
    c.json(
      await listRoutineSections(
        c.var.db,
        department(c.req.valid("param").department),
      ),
      200,
    ),
  )
  .openapi(getSectionRoute, async (c) => {
    const { department: slug, section } = c.req.valid("param");
    return c.json(
      await getRoutineSection(c.var.db, department(slug), section),
      200,
    );
  })
  .openapi(sectionPdfRoute, async (c) => {
    const { department: slug, section } = c.req.valid("param");
    const group = c.req.valid("query").group ?? null;
    const routine = await getRoutineSection(
      c.var.db,
      department(slug),
      section,
    );
    if (group && !routine.labGroups.includes(group)) {
      throw new AppError(
        404,
        "GROUP_NOT_FOUND",
        `${routine.section} has no lab group ${group}`,
      );
    }
    const page = new URL(
      `/routine/${slug}/${encodeURIComponent(routineSectionSlug(routine.section))}`,
      c.req.url,
    );
    if (group) page.searchParams.set("group", group);
    const pdf = await routinePdf({
      routine,
      group,
      pageUrl: page.toString(),
      today: dhakaToday(),
    });
    const filename = routinePdfFilename(routine, group);
    return c.body(pdf.slice().buffer, 200, {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "public, max-age=300",
    });
  })
  .openapi(listTeachersRoute, async (c) =>
    c.json(
      await listRoutineTeacherSummaries(
        c.var.db,
        department(c.req.valid("param").department),
      ),
      200,
    ),
  )
  .openapi(getTeacherRoute, async (c) => {
    const { department: slug, initials } = c.req.valid("param");
    return c.json(
      await getRoutineTeacherWeek(c.var.db, department(slug), initials),
      200,
    );
  })
  .openapi(teacherPdfRoute, async (c) => {
    const { department: slug, initials } = c.req.valid("param");
    const week = await getRoutineTeacherWeek(
      c.var.db,
      department(slug),
      initials,
    );
    const pdf = await teacherRoutinePdf({
      week,
      pageUrl: new URL(
        `/routine/${slug}/teachers/${encodeURIComponent(week.teacher.initials)}`,
        c.req.url,
      ).toString(),
      today: dhakaToday(),
    });
    return c.body(pdf.slice().buffer, 200, {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${teacherPdfFilename(week)}"`,
      "cache-control": "public, max-age=300",
    });
  });
