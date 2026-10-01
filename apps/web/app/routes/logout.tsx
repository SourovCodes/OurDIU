import { redirect } from "react-router";
import { apiFetch, setCookieHeaders } from "~/lib/api.server";
import { safeRedirect } from "~/lib/redirect";
import type { Route } from "./+types/logout";

/** Signs out, then goes to the form's `redirectTo` (the home page by default). */
export async function action({ request }: Route.ActionArgs) {
  const redirectTo = safeRedirect((await request.formData()).get("redirectTo"));
  const res = await apiFetch(request, "/api/auth/sign-out", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  return redirect(redirectTo, { headers: setCookieHeaders(res) });
}

export function loader() {
  return redirect("/");
}
