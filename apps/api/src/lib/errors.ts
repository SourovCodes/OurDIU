import type { ApiError } from "@ourdiu/shared";
import type { Hook } from "@hono/zod-openapi";
import type { Context, ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppEnv } from "../types";

/** Throw from handlers/services to return a structured error response. */
export class AppError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorBody(
  code: string,
  message: string,
  details?: unknown,
): ApiError {
  return {
    error: { code, message, ...(details === undefined ? {} : { details }) },
  };
}

export const validationHook: Hook<unknown, AppEnv, string, unknown> = (
  result,
  c: Context,
) => {
  if (!result.success) {
    return c.json(
      errorBody(
        "VALIDATION_ERROR",
        "Request validation failed",
        result.error.issues,
      ),
      422,
    );
  }
};

export const handleNotFound: NotFoundHandler<AppEnv> = (c) =>
  c.json(errorBody("NOT_FOUND", "Route not found"), 404);

export const handleError: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof AppError) {
    return c.json(errorBody(err.code, err.message, err.details), err.status);
  }
  if (err instanceof HTTPException) {
    return c.json(errorBody("HTTP_ERROR", err.message), err.status);
  }
  console.error("Unhandled error", err);
  return c.json(errorBody("INTERNAL_ERROR", "Something went wrong"), 500);
};
