import { DIU_EMAIL_DOMAINS } from "@ourdiu/shared/constants";
import {
  Bookmark,
  Loader2,
  ThumbsUp,
  Upload,
  type LucideIcon,
} from "lucide-react";
import {
  Form,
  Link,
  redirect,
  useNavigation,
  useSearchParams,
} from "react-router";
import {
  EXAM_INK as INK,
  ExamShape,
  type ExamKind,
} from "~/components/exam-badge";
import { FormMessage } from "~/components/form";
import { Button } from "~/components/ui/button";
import { apiFetch, readJson, setCookieHeaders } from "~/lib/api.server";
import { safeRedirect } from "~/lib/redirect";
import { cn } from "~/lib/utils";
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
    <svg viewBox="0 0 24 24" className="size-5!" aria-hidden>
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

/** What logging in is for, from the page it returns to. */
function reasonFor(back: string): { title: string; text: string } {
  const path = back.split(/[?#]/)[0]!;
  if (path.startsWith("/questions/contribute")) {
    return {
      title: "Log in to share a paper",
      text: `Sharing needs your DIU Google account (${DOMAINS}), so every paper comes from a DIU student.`,
    };
  }
  if (path === "/questions/saved") {
    return {
      title: "Log in to see your saved papers",
      text: "They’re kept with your account, here and in the OurDIU app.",
    };
  }
  if (path.startsWith("/questions/my-submissions")) {
    return {
      title: "Log in to see your papers",
      text: "The papers you shared, how their review went and how many students read them.",
    };
  }
  if (/^\/questions\/\d+$/.test(path)) {
    return {
      title: "Log in to save, vote and report",
      text: "You’ll be back on the paper you were reading straight away.",
    };
  }
  if (path.startsWith("/account")) {
    return {
      title: "Log in to your account",
      text: "Your profile, saved papers and the papers you shared.",
    };
  }
  return {
    title: "Log in to OurDIU",
    text: "One Google account for everything on OurDIU. Reading papers never needs one.",
  };
}

/** What an account is for, as in the app's sign-in card. */
const PERKS: {
  icon: LucideIcon;
  shape: ExamKind;
  title: string;
  text: string;
}[] = [
  {
    icon: Bookmark,
    shape: "final",
    title: "Save papers for exam week",
    text: "On the website and in the app, the same list.",
  },
  {
    icon: ThumbsUp,
    shape: "midterm",
    title: "Vote for the clearest copy",
    text: "The best copy of each exam comes first for everyone.",
  },
  {
    icon: Upload,
    shape: "quiz",
    title: "Share the papers you sat",
    text: "And see how many students read them. Needs a DIU email.",
  },
];

export default function Login({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const submitting = useNavigation().state !== "idle";
  const back = safeRedirect(searchParams.get("redirectTo"));
  const reason = reasonFor(back);

  return (
    <div className="mx-auto grid max-w-5xl gap-8 py-2 sm:py-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-12">
      <section className="space-y-6">
        <div className="space-y-3">
          <h1 className="font-display-xl text-4xl text-balance sm:text-6xl">
            {reason.title}
          </h1>
          <p className="max-w-xl text-lg text-pretty text-muted-foreground">
            {reason.text}
          </p>
        </div>
        <Form
          method="post"
          className="grid max-w-xl gap-4 rounded-[2rem] bg-primary-container p-6 text-primary-container-foreground sm:p-8"
        >
          <input type="hidden" name="redirectTo" value={back} />
          <FormMessage message={actionData?.error ?? loaderData.error} />
          <Button
            type="submit"
            variant="outline"
            size="lg"
            disabled={submitting}
            className="w-full border-input bg-background text-base text-foreground hover:bg-background/80 hover:text-foreground"
          >
            {submitting ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <GoogleIcon />
            )}
            {submitting ? "Opening Google…" : "Continue with Google"}
          </Button>
          <p className="text-sm text-pretty opacity-85">
            New here? Your account is made the first time you log in. We only
            keep your name, email and photo (
            <Link to="/privacy" className="underline underline-offset-2">
              privacy policy
            </Link>
            ).
          </p>
        </Form>
      </section>

      <aside aria-labelledby="perks" className="grid content-start gap-2">
        <h2
          id="perks"
          className="px-1 pb-1 text-sm font-semibold text-muted-foreground"
        >
          With an account you can
        </h2>
        {PERKS.map(({ icon: Icon, shape, title, text }) => (
          <div
            key={title}
            className="flex items-center gap-4 rounded-3xl bg-surface p-4"
          >
            <span className="relative flex size-12 shrink-0 items-center justify-center">
              <ExamShape kind={shape} className="absolute inset-0 size-full" />
              <Icon className={cn("relative size-5", INK[shape])} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">{title}</span>
              <span className="block text-sm text-pretty text-muted-foreground">
                {text}
              </span>
            </span>
          </div>
        ))}
        <p className="px-1 pt-2 text-sm text-pretty text-muted-foreground">
          Reading and downloading papers never needs an account.
        </p>
      </aside>
    </div>
  );
}
