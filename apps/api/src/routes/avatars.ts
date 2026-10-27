import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { avatarSchema } from "@ourdiu/shared";
import { AppError, validationHook } from "../lib/errors";
import { objectResponse } from "../lib/files";
import { errorResponse, jsonResponse } from "../lib/openapi";
import { requireAuth } from "../middleware/require-auth";
import {
  avatarUrl,
  getAvatarObject,
  IMMUTABLE,
  removeAvatar,
  setAvatar,
} from "../services/avatars";
import type { AppEnv } from "../types";

const tags = ["Profile images"];

const uploadAvatarRoute = createRoute({
  method: "put",
  path: "/me/avatar",
  tags,
  summary: "Upload or replace your profile image (JPEG, PNG or WebP, max 2 MB)",
  middleware: [requireAuth] as const,
  request: {
    body: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: z.object({
            file: z
              .instanceof(File, { error: "Choose an image" })
              .openapi({ type: "string", format: "binary" }),
          }),
        },
      },
    },
  },
  responses: {
    200: jsonResponse(avatarSchema, "The new image URL"),
    400: errorResponse("Invalid image"),
    401: errorResponse("Not signed in"),
    422: errorResponse("No file"),
  },
});

const removeAvatarRoute = createRoute({
  method: "delete",
  path: "/me/avatar",
  tags,
  summary: "Remove your profile image",
  middleware: [requireAuth] as const,
  responses: {
    204: { description: "Removed" },
    401: errorResponse("Not signed in"),
  },
});

const getAvatarRoute = createRoute({
  method: "get",
  path: "/avatars/{id}",
  tags,
  summary: "A profile image, or a redirect to its URL on the files domain",
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    301: { description: "The image's public URL" },
    200: {
      description: "Image",
      content: {
        "image/*": { schema: z.string().openapi({ format: "binary" }) },
      },
    },
    404: errorResponse("Image not found"),
    422: errorResponse("Invalid id"),
  },
});

export const avatarRoutes = new OpenAPIHono<AppEnv>({
  defaultHook: validationHook,
})
  .openapi(uploadAvatarRoute, async (c) =>
    c.json(
      await setAvatar(
        c.var.db,
        c.env.BUCKET,
        c.env.FILES_URL,
        c.var.session!.user.id,
        c.req.valid("form").file,
      ),
      200,
    ),
  )
  .openapi(removeAvatarRoute, async (c) => {
    await removeAvatar(
      c.var.db,
      c.env.BUCKET,
      c.env.FILES_URL,
      c.var.session!.user.id,
    );
    return c.body(null, 204);
  })
  .openapi(getAvatarRoute, async (c) => {
    const { id } = c.req.valid("param");
    // Users who set their image before it moved to the files domain keep this URL.
    if (c.env.FILES_URL) {
      c.header("cache-control", IMMUTABLE);
      return c.redirect(avatarUrl(c.env.FILES_URL, id), 301);
    }
    const object = await getAvatarObject(c.env.BUCKET, id);
    if (!object) throw new AppError(404, "NOT_FOUND", "Image not found");
    return objectResponse(object, IMMUTABLE);
  });
