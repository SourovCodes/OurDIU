import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { secureHeaders } from "hono/secure-headers";
import { handleError, handleNotFound, validationHook } from "./lib/errors";
import { openApiConfig } from "./lib/openapi";
import { contextMiddleware } from "./middleware/context";
import { adminRoutes } from "./routes/admin";
import { healthRoutes } from "./routes/health";
import { meRoutes } from "./routes/me";
import type { AppEnv } from "./types";

export function createApp() {
  const app = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });

  app.use("*", secureHeaders());
  app.use("*", contextMiddleware);

  // Better Auth owns everything under /api/auth (sign-in, sessions, ...). One account
  // system for every OurDIU product.
  app.on(["GET", "POST"], "/api/auth/*", (c) => c.var.auth.handler(c.req.raw));

  // Products (routine, question bank, marketplace) will each get their own prefix
  // next to the platform's own routes, e.g. /api/v1/routine.
  const v1 = new OpenAPIHono<AppEnv>({ defaultHook: validationHook })
    .route("/", healthRoutes)
    .route("/me", meRoutes)
    .route("/admin", adminRoutes);
  app.route("/api/v1", v1);

  app.doc31("/api/v1/openapi.json", openApiConfig);
  app.get("/api/docs", Scalar({ url: "/api/v1/openapi.json" }));

  app.notFound(handleNotFound);
  app.onError(handleError);

  return app;
}
