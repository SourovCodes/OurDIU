import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { avatarSchema } from "@ourdiu/shared";
import { AppError, validationHook } from "../lib/errors";
import { objectResponse } from "../lib/files";
import { errorResponse, jsonResponse } from "../lib/openapi";
import { requireAuth } from "../middleware/require-auth";
import { getAvatarObject, removeAvatar, setAvatar } from "../services/avatars";
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
  summary: "A profile image",
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
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
        c.var.session!.user.id,
        c.req.valid("form").file,
      ),
      200,
    ),
  )
  .openapi(removeAvatarRoute, async (c) => {
    await removeAvatar(c.var.db, c.env.BUCKET, c.var.session!.user.id);
    return c.body(null, 204);
  })
  .openapi(getAvatarRoute, async (c) => {
    const object = await getAvatarObject(c.env.BUCKET, c.req.valid("param").id);
    if (!object) throw new AppError(404, "NOT_FOUND", "Image not found");
    // Each upload gets a new id, so a URL's content never changes.
    return objectResponse(object, "public, max-age=31536000, immutable");
  });
