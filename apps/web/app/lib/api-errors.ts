import type { ApiError } from "@ourdiu/shared";

type Issue = { path?: PropertyKey[]; message?: string };

/** Maps the API's VALIDATION_ERROR issues to `{ fieldName: message }` for form display. */
export function fieldErrorsFrom(body: ApiError | null): Record<string, string> {
  if (
    body?.error.code !== "VALIDATION_ERROR" ||
    !Array.isArray(body.error.details)
  ) {
    return {};
  }
  const errors: Record<string, string> = {};
  for (const issue of body.error.details as Issue[]) {
    const field = issue.path?.[0];
    if (typeof field === "string" && issue.message && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
}
