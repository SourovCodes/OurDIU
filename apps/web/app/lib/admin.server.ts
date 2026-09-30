import { data, redirect } from "react-router";
import type { ActionResult } from "./action-result";
import { apiFetch, apiRequest, readJson } from "./api.server";

/** What an admin form action returns to its fetcher. */
export type AdminActionResult = ActionResult;

/**
 * Calls an admin API endpoint (`/api/v1/admin{path}`) on behalf of the signed-in admin
 * and turns the response into a result for the form that triggered it.
 */
export function adminRequest(
  request: Request,
  intent: string,
  method: string,
  path: string,
  body?: unknown,
) {
  return apiRequest(request, intent, method, `/api/v1/admin${path}`, body);
}

export { formObject } from "./form";

/**
 * GETs JSON from an admin endpoint for a loader. Non-admins get the same 404 as
 * `requireAdmin` gives them, and missing records a 404 too.
 */
export async function adminGetJson<T>(
  request: Request,
  path: string,
): Promise<T> {
  const res = await apiFetch(request, `/api/v1/admin${path}`);
  if (res.status === 401) {
    const { pathname, search } = new URL(request.url);
    throw redirect(
      `/login?redirectTo=${encodeURIComponent(pathname + search)}`,
    );
  }
  if (res.status === 403 || res.status === 404 || res.status === 422) {
    throw data("Not found", { status: 404 });
  }
  if (!res.ok) throw data(`API request failed: ${path}`, { status: 502 });
  return readJson<T>(res);
}
