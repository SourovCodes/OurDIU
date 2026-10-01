import { DIU_EMAIL_DOMAINS } from "@ourdiu/shared/constants";
import { Form, redirect, useNavigation, useSearchParams } from "react-router";
import { AuthCard } from "~/components/auth-card";
import { FormMessage } from "~/components/form";
import { Button } from "~/components/ui/button";
import { apiFetch, readJson, setCookieHeaders } from "~/lib/api.server";
import { safeRedirect } from "~/lib/redirect";
import { getUser } from "~/lib/session.server";
import type { Route } from "./+types/login";

export const meta: Route.MetaFunction = () => [
  { title: "Log in — OurDIU" },
  { name: "robots", content: "noindex" },
];

/** "@diu.edu.bd or @s.diu.edu.bd" */
const DOMAINS = DIU_EMAIL_DOMAINS.map((domain) => `@${domain}`).join(" or ");

/** Better Auth sends failed Google sign-ins back here with `?error=<code>`. */
function signInError(code: string | null) {
  if (!code) return undefined;
  if (code === "access_denied") return "Google sign-in was cancelled.";
  return "Could not sign in with Google. Please try again.";
}

export async function loader({ request }: Route.LoaderArgs) {
  if (await getUser(request)) throw redirect("/");
  return { error: signInError(new URL(request.url).searchParams.get("error")) };
}

export async function action({ request }: Route.ActionArgs) {
  const redirectTo = safeRedirect((await request.formData()).get("redirectTo"));
  const res = await apiFetch(request, "/api/auth/sign-in/social", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: "google",
      callbackURL: redirectTo,
      errorCallbackURL: `/login?redirectTo=${encodeURIComponent(redirectTo)}`,
    }),
  });
  const body = res.ok
    ? await readJson<{ url?: string }>(res).catch(() => null)
    : null;
  if (!body?.url) {
    return { error: "Could not reach Google. Please try again." };
  }
  // The response also sets the OAuth state cookie, checked when Google sends the
  // visitor back to /api/auth/callback/google.
  throw redirect(body.url, { headers: setCookieHeaders(res) });
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28V6.61H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

export default function Login({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const submitting = useNavigation().state !== "idle";

  return (
    <AuthCard
      title="Log in"
      description={`Sign in with Google. To contribute question papers, use your DIU account (${DOMAINS}).`}
      footer="New here? Your account is created the first time you log in. We only use your name, email and photo."
    >
      <Form method="post" className="grid gap-4">
        <input
          type="hidden"
          name="redirectTo"
          value={searchParams.get("redirectTo") ?? "/"}
        />
        <FormMessage message={actionData?.error ?? loaderData.error} />
        <Button type="submit" variant="outline" disabled={submitting}>
          <GoogleIcon />
          {submitting ? "Opening Google…" : "Continue with Google"}
        </Button>
      </Form>
    </AuthCard>
  );
}
