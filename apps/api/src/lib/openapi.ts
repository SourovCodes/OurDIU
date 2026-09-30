import type { z } from "@hono/zod-openapi";
import { apiErrorSchema } from "@ourdiu/shared";

export function jsonResponse<T extends z.ZodType>(
  schema: T,
  description: string,
) {
  return { description, content: { "application/json": { schema } } };
}

export function errorResponse(description: string) {
  return jsonResponse(apiErrorSchema, description);
}

/** The OpenAPI document's header, shared by the served spec and `pnpm openapi`. */
export const openApiConfig = {
  openapi: "3.1.0",
  info: { title: "OurDIU API", version: "1.0.0" },
} as const;
