import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  profileSchema,
  updateUsernameInputSchema,
  USERNAME_RULES,
} from "@ourdiu/shared";
import { validationHook } from "../lib/errors";
import { errorResponse, jsonResponse } from "../lib/openapi";
import { requireAuth } from "../middleware/require-auth";
import { getProfile, updateUsername } from "../services/account";
import type { AppEnv } from "../types";

const tags = ["Account"];

const getProfileRoute = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "Get your profile",
  middleware: [requireAuth] as const,
  responses: {
    200: jsonResponse(profileSchema, "Your profile"),
    401: errorResponse("Not signed in"),
  },
});

const updateUsernameRoute = createRoute({
  method: "put",
  path: "/username",
  tags,
  summary: "Change your username",
  description: `${USERNAME_RULES}; saved in lowercase.`,
  middleware: [requireAuth] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: updateUsernameInputSchema } },
    },
  },
  responses: {
    200: jsonResponse(updateUsernameInputSchema, "Your new username"),
    401: errorResponse("Not signed in"),
    409: errorResponse("Someone already has that username"),
    422: errorResponse("Not a valid username"),
  },
});

export const meRoutes = new OpenAPIHono<AppEnv>({
  defaultHook: validationHook,
})
  .openapi(getProfileRoute, async (c) =>
    c.json(await getProfile(c.var.db, c.var.session!.user.id), 200),
  )
  .openapi(updateUsernameRoute, async (c) =>
    c.json(
      {
        username: await updateUsername(
          c.var.db,
          c.var.session!.user.id,
          c.req.valid("json").username,
        ),
      },
      200,
    ),
  );
