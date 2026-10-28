import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  createdRoomReportSchema,
  createRoomReportInputSchema,
  idQuerySchema,
  roomSummarySchema,
} from "@ourdiu/shared";
import { canContribute } from "@ourdiu/shared/constants";
import {
  ROOM_CLOSE,
  type RoomCloseCode,
  type RoomErrorCode,
} from "@ourdiu/shared/rooms";
import type { Context } from "hono";
import { AppError, validationHook } from "../lib/errors";
import { errorResponse, jsonResponse } from "../lib/openapi";
import { rateLimit } from "../middleware/rate-limit";
import { requireAuth } from "../middleware/require-auth";
import { requireContributor } from "../middleware/require-contributor";
import { ROOM_USER_HEADER, type RoomUser } from "../services/rooms/user";
import {
  courseExists,
  createRoomReport,
  isRoomBanned,
} from "../services/rooms/moderation";
import { refuseSocket } from "../services/rooms/refuse";
import { roomLimits } from "../services/rooms/usage";
import type { AppEnv } from "../types";

const tags = ["Course rooms"];
const params = z.object({ courseId: idQuerySchema });

/** The course's room. One Durable Object per course, wherever it's asked from. */
export function courseRoom(env: Env, courseId: number) {
  return env.ROOMS_DO.get(env.ROOMS_DO.idFromName(`course:${courseId}`));
}

/** Counts change by the second; this keeps busy course pages off the room. */
const SUMMARY_MAX_AGE = 15;

const summaryRoute = createRoute({
  method: "get",
  path: "/{courseId}",
  tags,
  summary: "How many are in a course's room",
  description: `Public: counts only, no names. Cached for ${SUMMARY_MAX_AGE} seconds.`,
  request: { params },
  responses: {
    200: jsonResponse(roomSummarySchema, "Who's in the room"),
    422: errorResponse("Invalid id"),
  },
});

const socketRoute = createRoute({
  method: "get",
  path: "/{courseId}/socket",
  tags,
  summary: "Join a course's room (WebSocket)",
  description:
    "Upgrades to a WebSocket into the course's room: presence, chat (relayed, never " +
    "stored) and the voice call's signalling with Cloudflare's Realtime SFU. Messages " +
    "are JSON, `RoomClientMessage` and `RoomServerMessage` in `packages/shared/src/rooms.ts`; " +
    'send the text "ping" to keep the connection open. For DIU email accounts (and ' +
    "admins). A refused WebSocket is accepted, sent an `error` and closed with a " +
    "4xxx code (`ROOM_CLOSE`); without an upgrade, refusals are JSON errors.",
  request: { params },
  responses: {
    101: { description: "Switched to a WebSocket" },
    401: errorResponse("Not signed in"),
    403: errorResponse("Not a DIU email account, or banned from rooms"),
    404: errorResponse("Course not found"),
    426: errorResponse("Not a WebSocket request"),
    503: errorResponse("Course rooms are closed"),
  },
});

const reportRoute = createRoute({
  method: "post",
  path: "/{courseId}/reports",
  tags,
  summary: "Report someone in a course's room",
  description:
    "For admins to review. Chat isn't stored, so a reported message is kept only as the reporter sends it.",
  middleware: [
    requireAuth,
    requireContributor,
    rateLimit(
      "REPORT_LIMITER",
      "You've sent a lot of reports. Please wait a minute and try again.",
    ),
  ] as const,
  request: {
    params,
    body: {
      required: true,
      content: { "application/json": { schema: createRoomReportInputSchema } },
    },
  },
  responses: {
    201: jsonResponse(createdRoomReportSchema, "Report filed"),
    401: errorResponse("Not signed in"),
    403: errorResponse("Not a DIU email account"),
    404: errorResponse("Course or user not found"),
    422: errorResponse("Invalid report"),
    429: errorResponse("Too many reports"),
  },
});

/** Refuses a connection: over the socket for a WebSocket, else as a JSON error. */
function refuse(
  c: Context<AppEnv>,
  status: 401 | 403 | 404 | 503,
  code: RoomErrorCode,
  close: RoomCloseCode,
  message: string,
): Response {
  if (c.req.header("upgrade")?.toLowerCase() === "websocket") {
    return refuseSocket(code, close, message);
  }
  throw new AppError(status, code, message);
}

export const roomRoutes = new OpenAPIHono<AppEnv>({
  defaultHook: validationHook,
})
  .openapi(summaryRoute, async (c) => {
    const { courseId } = c.req.valid("param");
    // Workers' default cache (the web project's DOM types don't know it).
    const cache = (caches as unknown as { default: Cache }).default;
    const key = new Request(new URL(c.req.url).toString());
    const hit = await cache.match(key);
    // A cached response's headers are immutable; the API's middleware adds some.
    if (hit) return new Response(hit.body, hit) as never;
    const summary = await courseRoom(c.env, courseId).summary();
    const res = c.json(summary, 200, {
      "cache-control": `public, max-age=${SUMMARY_MAX_AGE}`,
    });
    c.executionCtx.waitUntil(cache.put(key, res.clone()));
    return res;
  })
  .openapi(socketRoute, async (c) => {
    const { courseId } = c.req.valid("param");
    if (!roomLimits(c.env).enabled) {
      return refuse(
        c,
        503,
        "CLOSED",
        ROOM_CLOSE.CLOSED,
        "Course rooms are closed for now",
      ) as never;
    }
    const session = await c.var.auth.api.getSession({
      headers: c.req.raw.headers,
    });
    if (!session) {
      return refuse(
        c,
        401,
        "SIGNED_OUT",
        ROOM_CLOSE.SIGNED_OUT,
        "Sign in to join the room",
      ) as never;
    }
    const { user } = session;
    if (!canContribute(user)) {
      return refuse(
        c,
        403,
        "DIU_ONLY",
        ROOM_CLOSE.DIU_ONLY,
        "Course rooms are for DIU email accounts",
      ) as never;
    }
    const [exists, banned] = await Promise.all([
      courseExists(c.var.db, courseId),
      isRoomBanned(c.var.db, user.id),
    ]);
    if (!exists) {
      return refuse(
        c,
        404,
        "NOT_FOUND",
        ROOM_CLOSE.NOT_FOUND,
        "Course not found",
      ) as never;
    }
    if (banned) {
      return refuse(
        c,
        403,
        "BANNED",
        ROOM_CLOSE.BANNED,
        "An admin has kept you out of course rooms",
      ) as never;
    }
    if (c.req.header("upgrade")?.toLowerCase() !== "websocket") {
      throw new AppError(426, "UPGRADE_REQUIRED", "Connect with a WebSocket");
    }
    const headers = new Headers({ upgrade: "websocket" });
    headers.set(
      ROOM_USER_HEADER,
      JSON.stringify({
        id: user.id,
        name: user.name,
        image: user.image ?? null,
        admin: user.role === "admin",
      } satisfies RoomUser),
    );
    const res = await courseRoom(c.env, courseId).fetch(
      new Request(c.req.url, { headers }),
    );
    // The room's response has immutable headers; the API's middleware adds some.
    return new Response(res.body, {
      status: res.status,
      headers: res.headers,
      webSocket: res.webSocket,
    }) as never;
  })
  .openapi(reportRoute, async (c) =>
    c.json(
      await createRoomReport(
        c.var.db,
        c.req.valid("param").courseId,
        c.var.session!.user.id,
        c.req.valid("json"),
      ),
      201,
    ),
  );
