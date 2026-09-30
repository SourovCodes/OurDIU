import { redirect } from "react-router";
import { apiFetch, setCookieHeaders } from "~/lib/api.server";
import type { Route } from "./+types/logout";

export async function action({ request }: Route.ActionArgs) {
  const res = await apiFetch(request, "/api/auth/sign-out", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  return redirect("/", { headers: setCookieHeaders(res) });
}

export function loader() {
  return redirect("/");
}
