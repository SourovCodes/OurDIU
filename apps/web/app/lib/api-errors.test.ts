import { describe, expect, it } from "vitest";
import { fieldErrorsFrom } from "./api-errors";

describe("fieldErrorsFrom", () => {
  it("maps validation issues to the first message per field", () => {
    const errors = fieldErrorsFrom({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: [
          { path: ["courseId"], message: "Select a course or add a new one" },
          { path: ["courseId"], message: "Ignored" },
          { path: ["file"], message: "Choose a PDF file" },
        ],
      },
    });
    expect(errors).toEqual({
      courseId: "Select a course or add a new one",
      file: "Choose a PDF file",
    });
  });

  it("returns nothing for other errors", () => {
    expect(
      fieldErrorsFrom({
        error: { code: "INVALID_FILE", message: "The file must be a PDF" },
      }),
    ).toEqual({});
    expect(fieldErrorsFrom(null)).toEqual({});
  });
});
