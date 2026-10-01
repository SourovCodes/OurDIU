import {
  MAX_AVATAR_BYTES,
  type AVATAR_CONTENT_TYPES,
  type Avatar,
} from "@ourdiu/shared";
import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { user } from "../db/schema";
import { AppError } from "../lib/errors";

type AvatarContentType = (typeof AVATAR_CONTENT_TYPES)[number];

/** user.image holds this prefix + the object id for images stored in R2. */
export const AVATAR_URL_PREFIX = "/api/v1/avatars/";
const objectKey = (id: string) => `avatars/${id}`;

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, i) => bytes[offset + i] === byte);

/** Detects the image type from its first bytes, ignoring the client's claimed type. */
function detectImageType(bytes: Uint8Array): AvatarContentType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  // "RIFF" <size> "WEBP"
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp";
  }
  return null;
}

async function deleteStoredAvatar(bucket: R2Bucket, image?: string | null) {
  if (image?.startsWith(AVATAR_URL_PREFIX)) {
    await bucket.delete(objectKey(image.slice(AVATAR_URL_PREFIX.length)));
  }
}

async function currentImage(db: Database, userId: string) {
  const row = await db.query.user.findFirst({
    columns: { image: true },
    where: eq(user.id, userId),
  });
  return row?.image;
}

/** Stores a new profile image and removes the previous one. */
export async function setAvatar(
  db: Database,
  bucket: R2Bucket,
  userId: string,
  file: File,
): Promise<Avatar> {
  if (file.size === 0 || file.size > MAX_AVATAR_BYTES) {
    throw new AppError(
      400,
      "INVALID_FILE",
      `The image must be smaller than ${MAX_AVATAR_BYTES / 1024 / 1024} MB`,
    );
  }
  const contentType = detectImageType(
    new Uint8Array(await file.slice(0, 12).arrayBuffer()),
  );
  if (!contentType) {
    throw new AppError(400, "INVALID_FILE", "Upload a JPEG, PNG or WebP image");
  }

  // A fresh id per upload, so the URL can be cached forever.
  const id = crypto.randomUUID();
  await bucket.put(objectKey(id), file, { httpMetadata: { contentType } });

  const previous = await currentImage(db, userId);
  const image = `${AVATAR_URL_PREFIX}${id}`;
  try {
    await db.update(user).set({ image }).where(eq(user.id, userId));
  } catch (err) {
    await bucket.delete(objectKey(id));
    throw err;
  }
  await deleteStoredAvatar(bucket, previous);
  return { image };
}

export async function removeAvatar(
  db: Database,
  bucket: R2Bucket,
  userId: string,
) {
  const previous = await currentImage(db, userId);
  await db.update(user).set({ image: null }).where(eq(user.id, userId));
  await deleteStoredAvatar(bucket, previous);
}

export function getAvatarObject(bucket: R2Bucket, id: string) {
  return bucket.get(objectKey(id));
}

/** Profile photos from Google, which end in a size option like `=s96-c`. */
const GOOGLE_PHOTO = /^https:\/\/lh\d+\.googleusercontent\.com\//;

/** The original-size photo: Google's URL without the trailing size option. */
export function fullSizeGooglePhoto(url: string) {
  return url.replace(/=[^/=]*$/, "");
}

/**
 * Copies a new user's Google photo into R2, so it is served from our own URL like an
 * upload. Tries the full-size photo first, then the size Google sent. Never throws:
 * if both fail (too large, not JPEG/PNG/WebP, Google unreachable), the user keeps
 * Google's URL.
 */
export async function importGoogleAvatar(
  db: Database,
  bucket: R2Bucket,
  userId: string,
  url: string,
) {
  if (!GOOGLE_PHOTO.test(url)) return;
  for (const candidate of new Set([fullSizeGooglePhoto(url), url])) {
    try {
      const res = await fetch(candidate, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) continue;
      const file = new File([await res.blob()], "google-photo");
      await setAvatar(db, bucket, userId, file);
      return;
    } catch {
      // Try the next size.
    }
  }
}
