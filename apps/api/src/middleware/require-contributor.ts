import { canContribute, DIU_EMAIL_REQUIRED } from "@ourdiu/shared/constants";
import { createMiddleware } from "hono/factory";
import { AppError } from "../lib/errors";
import type { AppEnv } from "../types";

/**
 * After `requireAuth`: anyone can have an account, but only DIU addresses (and
 * admins) can contribute papers.
 */
export const requireContributor = createMiddleware<AppEnv>(async (c, next) => {
  if (!canContribute(c.var.session!.user)) {
    throw new AppError(
      403,
      DIU_EMAIL_REQUIRED,
      "Only DIU email addresses can contribute papers. Sign in with your DIU Google account to upload.",
    );
  }
  await next();
});
