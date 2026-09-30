import api from "@ourdiu/api";
import type { ApiError } from "@ourdiu/shared";
import { env } from "cloudflare:workers";
import { data } from "react-router";
import type { ActionResult } from "./action-result";
import { fieldErrorsFrom } from "./api-errors";

/**
 * Calls the API in-process (it runs in this Worker) on behalf of the incoming
 * request, forwarding the user's cookies so the API sees the same session as the
 * browser.
 */
export function apiFetch(
  request: Request,
  path: string,
  init: RequestInit = {},
) {
  const origin = new URL(request.url).origin;
  const headers = new Headers(init.headers);
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  headers.set("origin", origin);
  return api.fetch(
    new Request(new URL(path, origin), { ...init, headers }),
    env,
  );
}

export async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

/** GETs JSON from the API, turning any failure into a 502 error response. */
export async function apiGetJson<T>(
  request: Request,
  path: string,
): Promise<T> {
  const res = await apiFetch(request, path);
  if (!res.ok) throw data(`API request failed: ${path}`, { status: 502 });
  return readJson<T>(res);
}

/** Copies Set-Cookie headers from an API response so they can be sent to the browser. */
export function setCookieHeaders(res: Response) {
  const headers = new Headers();
  for (const cookie of res.headers.getSetCookie())
    headers.append("set-cookie", cookie);
  return headers;
}

/**
 * Calls an API endpoint for a form action and turns the response into a result for
 * the form: field errors, or the API's message.
 */
export async function apiRequest(
  request: Request,
  intent: string,
  method: string,
  path: string,
  body?: unknown,
) {
  const res = await apiFetch(request, path, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  if (res.ok) return data<ActionResult>({ ok: true, intent });

  const error = await readJson<ApiError>(res).catch(() => null);
  const fieldErrors = fieldErrorsFrom(error);
  return data<ActionResult>(
    {
      ok: false,
      intent,
      error:
        Object.keys(fieldErrors).length > 0
          ? "Check the highlighted fields."
          : (error?.error.message ?? "Something went wrong. Please try again."),
      fieldErrors,
    },
    // 4xx skips revalidation: nothing changed.
    { status: res.status >= 500 ? 502 : res.status },
  );
}
