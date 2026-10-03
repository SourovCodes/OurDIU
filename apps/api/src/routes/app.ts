import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { androidAppSchema } from "@ourdiu/shared";
import { jsonResponse } from "../lib/openapi";
import type { AppEnv } from "../types";

const androidAppRoute = createRoute({
  method: "get",
  path: "/android",
  tags: ["App"],
  summary: "What the Android app needs to know about itself",
  description:
    "The oldest app version that still works (`ANDROID_MIN_VERSION` in wrangler.jsonc). The app checks it at launch and asks to be updated when it is older.",
  responses: { 200: jsonResponse(androidAppSchema, "The app's settings") },
});

export const appRoutes = new OpenAPIHono<AppEnv>().openapi(
  androidAppRoute,
  (c) => c.json({ minVersion: c.env.ANDROID_MIN_VERSION }, 200),
);
