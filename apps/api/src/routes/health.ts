import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppEnv } from "../types";

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["System"],
  responses: {
    200: {
      description: "Service is up",
      content: {
        "application/json": { schema: z.object({ status: z.literal("ok") }) },
      },
    },
  },
});

export const healthRoutes = new OpenAPIHono<AppEnv>().openapi(
  healthRoute,
  (c) => c.json({ status: "ok" as const }, 200),
);
