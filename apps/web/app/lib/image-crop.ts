/**
 * Turns the region a user picked in the cropper into a small square image file.
 * Cropping happens in the browser; the API only ever sees the finished square.
 */

/** Cropped avatars are re-encoded to at most this many pixels per side. */
export const AVATAR_OUTPUT_SIZE = 512;
/** Source images are decoded in the browser, so the crop's own size is what matters. */
export const MAX_AVATAR_SOURCE_BYTES = 20 * 1024 * 1024;

const OUTPUT_TYPE = "image/webp";
const OUTPUT_QUALITY = 0.9;
const EXTENSIONS: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
};

/** A region of the source image, in its own pixels. */
export type CropArea = { x: number; y: number; width: number; height: number };

/** Never upscales: a crop smaller than the target keeps its own resolution. */
export function outputSize(cropWidth: number) {
  return Math.max(1, Math.min(AVATAR_OUTPUT_SIZE, Math.round(cropWidth)));
}

/** "Holiday photo.JPG" re-encoded as WebP becomes "Holiday photo.webp". */
export function croppedFileName(original: string, type: string) {
  const base = original.replace(/\.[^./\\]+$/, "").trim();
  return `${base || "avatar"}.${EXTENSIONS[type] ?? "webp"}`;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be loaded"));
    image.src = src;
  });
}

/** Draws the picked region onto a square canvas and returns it as a file to upload. */
export async function cropToFile(
  src: string,
  area: CropArea,
  fileName: string,
): Promise<File> {
  const image = await loadImage(src);
  const size = outputSize(area.width);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The image could not be cropped");
  context.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    size,
    size,
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, OUTPUT_TYPE, OUTPUT_QUALITY),
  );
  if (!blob) throw new Error("The image could not be cropped");
  // A browser that can't encode WebP falls back to PNG, which the API accepts too.
  return new File([blob], croppedFileName(fileName, blob.type), {
    type: blob.type,
  });
}
