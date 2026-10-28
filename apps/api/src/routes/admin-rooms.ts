import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  adminRoomsSchema,
  idQuerySchema,
  roomBanInputSchema,
  roomSettingsInputSchema,
  updateRoomReportInputSchema,
} from "@ourdiu/shared";
import { and, eq } from "drizzle-orm";
import { roomReports } from "../db/schema";
import { validationHook } from "../lib/errors";
import { errorResponse, jsonResponse } from "../lib/openapi";
import { requireAdmin } from "../middleware/require-admin";
import {
  banFromRooms,
  listAdminRooms,
  unbanFromRooms,
  updateRoomReport,
} from "../services/rooms/moderation";
import { setRoomsPaused } from "../services/rooms/usage";
import type { AppEnv } from "../types";
import { courseRoom } from "./rooms";

const tags = ["Admin: course rooms"];
const middleware = requireAdmin;
const userParams = z.object({ userId: z.string().min(1).max(64) });
const jsonBody = <T extends z.ZodType>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
});
const denied = {
  401: errorResponse("Not signed in"),
  403: errorResponse("Not an admin"),
};

const overviewRoute = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "Usage this cycle, open reports and bans",
  middleware,
  responses: { 200: jsonResponse(adminRoomsSchema, "Course rooms"), ...denied },
});

const settingsRoute = createRoute({
  method: "put",
  path: "/settings",
  tags,
  summary: "Pause or resume every room",
  description: "Rooms see a pause within a minute; calls in progress end.",
  middleware,
  request: { body: jsonBody(roomSettingsInputSchema) },
  responses: { 204: { description: "Saved" }, ...denied },
});

const reportRoute = createRoute({
  method: "patch",
  path: "/reports/{id}",
  tags,
  summary: "Resolve or dismiss a room report",
  middleware,
  request: {
    params: z.object({ id: idQuerySchema }),
    body: jsonBody(updateRoomReportInputSchema),
  },
  responses: {
    204: { description: "Updated" },
    ...denied,
    404: errorResponse("No open report with that id"),
  },
});

const banRoute = createRoute({
  method: "put",
  path: "/bans/{userId}",
  tags,
  summary: "Keep someone out of every room",
  description:
    "With `reportId`, they're also taken out of that report's room now, and the report is resolved.",
  middleware,
  request: {
    params: userParams,
    body: jsonBody(roomBanInputSchema),
  },
  responses: {
    204: { description: "Banned" },
    ...denied,
    404: errorResponse("User not found"),
  },
});

const unbanRoute = createRoute({
  method: "delete",
  path: "/bans/{userId}",
  tags,
  summary: "Let someone back into rooms",
  middleware,
  request: { params: userParams },
  responses: { 204: { description: "Unbanned" }, ...denied },
});

export const adminRoomRoutes = new OpenAPIHono<AppEnv>({
  defaultHook: validationHook,
})
  .openapi(overviewRoute, async (c) =>
    c.json(await listAdminRooms(c.var.db, c.env), 200),
  )
  .openapi(settingsRoute, async (c) => {
    await setRoomsPaused(c.var.db, c.req.valid("json").paused);
    return c.body(null, 204);
  })
  .openapi(reportRoute, async (c) => {
    await updateRoomReport(
      c.var.db,
      c.req.valid("param").id,
      c.req.valid("json").status,
    );
    return c.body(null, 204);
  })
  .openapi(banRoute, async (c) => {
    const { userId } = c.req.valid("param");
    const { reportId } = c.req.valid("json");
    await banFromRooms(c.var.db, userId, c.var.session!.user.id);
    if (reportId !== undefined) {
      const [report] = await c.var.db
        .update(roomReports)
        .set({ status: "resolved" })
        .where(
          and(
            eq(roomReports.id, reportId),
            eq(roomReports.reportedUserId, userId),
          ),
        )
        .returning({ courseId: roomReports.courseId });
      if (report) await courseRoom(c.env, report.courseId).kick(userId, true);
    }
    return c.body(null, 204);
  })
  .openapi(unbanRoute, async (c) => {
    await unbanFromRooms(c.var.db, c.req.valid("param").userId);
    return c.body(null, 204);
  });
