import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { sitemapSchema } from "@ourdiu/shared";
import { validationHook } from "../lib/errors";
import { jsonResponse } from "../lib/openapi";
import { getSitemap } from "../services/sitemap";
import type { AppEnv } from "../types";

const getSitemapRoute = createRoute({
  method: "get",
  path: "/sitemap",
  tags: ["Sitemap"],
  summary: "List the public pages with published papers, for sitemap.xml",
  responses: { 200: jsonResponse(sitemapSchema, "Questions and contributors") },
});

export const sitemapRoutes = new OpenAPIHono<AppEnv>({
  defaultHook: validationHook,
}).openapi(getSitemapRoute, async (c) =>
  c.json(await getSitemap(c.var.db), 200),
);
