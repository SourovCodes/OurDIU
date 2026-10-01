import { describe, expect, it } from "vitest";
import { AVATAR_OUTPUT_SIZE, croppedFileName, outputSize } from "./image-crop";

describe("outputSize", () => {
  it("caps large crops at the avatar size", () => {
    expect(outputSize(2048)).toBe(AVATAR_OUTPUT_SIZE);
  });

  it("keeps a smaller crop's own resolution instead of upscaling", () => {
    expect(outputSize(120.4)).toBe(120);
  });

  it("never returns a zero-sized canvas", () => {
    expect(outputSize(0.2)).toBe(1);
  });
});

describe("croppedFileName", () => {
  it("swaps the extension for the encoded type", () => {
    expect(croppedFileName("Holiday photo.JPG", "image/webp")).toBe(
      "Holiday photo.webp",
    );
    expect(croppedFileName("me.heic", "image/png")).toBe("me.png");
    expect(croppedFileName("me.png", "image/jpeg")).toBe("me.jpg");
  });

  it("falls back to webp for an unknown type", () => {
    expect(croppedFileName("me.png", "application/octet-stream")).toBe(
      "me.webp",
    );
  });

  it("names an extensionless or empty file", () => {
    expect(croppedFileName("photo", "image/webp")).toBe("photo.webp");
    expect(croppedFileName(".jpg", "image/webp")).toBe("avatar.webp");
  });
});
