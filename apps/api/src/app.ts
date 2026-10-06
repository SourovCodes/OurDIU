import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { secureHeaders } from "hono/secure-headers";
import { handleError, handleNotFound, validationHook } from "./lib/errors";
import { openApiConfig } from "./lib/openapi";
import { contextMiddleware } from "./middleware/context";
import { adminRoutes } from "./routes/admin";
import { adminRoutineRoutes } from "./routes/admin-routine";
import { appRoutes } from "./routes/app";
import { avatarRoutes } from "./routes/avatars";
import { contributorRoutes } from "./routes/contributors";
import { coverPageRoutes } from "./routes/cover-page";
import { engagementRoutes } from "./routes/engagement";
import { healthRoutes } from "./routes/health";
import { meRoutes } from "./routes/me";
import { questionRoutes } from "./routes/questions";
import { routineRoutes } from "./routes/routine";
import { sitemapRoutes } from "./routes/sitemap";
import { submissionRoutes } from "./routes/submissions";
import { taxonomyRoutes } from "./routes/taxonomy";
import type { AppEnv } from "./types";

export function createApp() {
  const app = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });

  app.use("*", secureHeaders());
  app.use("*", contextMiddleware);

  // Better Auth owns everything under /api/auth (sign-up, sign-in, sessions, ...).
  app.on(["GET", "POST"], "/api/auth/*", (c) => c.var.auth.handler(c.req.raw));

  const v1 = new OpenAPIHono<AppEnv>({ defaultHook: validationHook })
    .route("/", healthRoutes)
    .route("/", taxonomyRoutes)
    .route("/", sitemapRoutes)
    .route("/questions", questionRoutes)
    .route("/submissions", submissionRoutes)
    .route("/contributors", contributorRoutes)
    .route("/me", meRoutes)
    .route("/routine", routineRoutes)
    .route("/cover-page", coverPageRoutes)
    .route("/admin/routine", adminRoutineRoutes)
    .route("/admin", adminRoutes)
    .route("/app", appRoutes)
    .route("/", engagementRoutes)
    .route("/", avatarRoutes);
  app.route("/api/v1", v1);

  app.doc31("/api/v1/openapi.json", openApiConfig);
  app.get("/api/docs", Scalar({ url: "/api/v1/openapi.json" }));

  app.notFound(handleNotFound);
  app.onError(handleError);

  return app;
}
