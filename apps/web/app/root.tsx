// Roboto Flex, as in the app: the weight and width axes (headings are wide).
import "@fontsource-variable/roboto-flex/standard.css";
// The one subset every page needs; the CSS alone would find it only after it loads.
import robotoFlexLatin from "@fontsource-variable/roboto-flex/files/roboto-flex-latin-standard-normal.woff2?url";
import type { ReviewActivity } from "@ourdiu/shared";
import { FileQuestion, GraduationCap, TriangleAlert } from "lucide-react";
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useMatches,
  useRouteError,
  useRouteLoaderData,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import type { Route } from "./+types/root";
import "./app.css";
import { EmptyState } from "~/components/empty-state";
import { PageTransition, SkipLink } from "~/components/page-transition";
import { AndroidBetaStrip } from "~/components/android-beta";
import { RoutineBottomBar } from "~/components/routine-nav";
import { SiteHeader } from "~/components/site-header";
import { SocialIcon } from "~/components/social-icons";
import { buttonVariants } from "~/components/ui/button";
import { TopLoader } from "~/components/top-loader";
import { routineIsLive } from "~/lib/routine.server";
import { Toaster } from "~/components/ui/sonner";
import {
  analyticsEnabled,
  GA_MEASUREMENT_ID,
  GTAG_SCRIPT,
  usePageViews,
} from "~/lib/analytics";
import { androidInvite } from "~/lib/android-app";
import { AUTHOR } from "~/lib/author";
import { LEGAL_PAGES } from "~/lib/legal";
import { PRODUCTS, productAt, rememberedSpace } from "~/lib/products";
import { canonicalUrl, OG_IMAGE, SITE_NAME } from "~/lib/seo";
import { useRememberSpace, useSpace } from "~/lib/use-space";
import { apiFetch, readJson } from "~/lib/api.server";
import { getUser, hasSessionCookie } from "~/lib/session.server";
import { THEME_SCRIPT } from "~/lib/theme";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  {
    rel: "preload",
    href: robotoFlexLatin,
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  },
];

/** How many of the signed-in user's papers need them, for the header's badge. */
async function reviewActivity(request: Request) {
  if (!hasSessionCookie(request)) return 0;
  const res = await apiFetch(request, "/api/v1/me/review-activity");
  if (!res.ok) return 0;
  return (await readJson<ReviewActivity>(res)).needsAttention;
}

export async function loader({ request }: Route.LoaderArgs) {
  const [user, needsAttention, routineLive] = await Promise.all([
    getUser(request),
    reviewActivity(request),
    routineIsLive(request),
  ]);
  return {
    user,
    needsAttention,
    // Whether the switchers show the Class Routine as live or "soon".
    routineLive,
    androidInvite: androidInvite(request),
    space: rememberedSpace(request.headers.get("cookie"))?.id ?? null,
    // The site's own origin: canonicalHostRedirect sends every other host here.
    origin: new URL(request.url).origin,
  };
}
export type RootLoader = typeof loader;

// The session only changes through form actions (log in, sign up, log out), so
// plain navigations don't need to re-fetch it. The review badge also changes when
// the user opens or leaves their submissions.
export function shouldRevalidate({
  formMethod,
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  const submissions = (url: URL) =>
    url.pathname.startsWith("/questions/my-submissions");
  return formMethod || submissions(currentUrl) || submissions(nextUrl)
    ? defaultShouldRevalidate
    : false;
}

/**
 * Set `handle = { ownShell: true }` on a route that brings its own shell (the admin
 * panel), `ogImage` (a path, 1200×630) for a link preview of its own, and
 * `samePage` when moving between its paths shouldn't start the page afresh.
 */
export type RouteHandle = {
  ownShell?: boolean;
  ogImage?: string;
  samePage?: boolean;
};

/**
 * The head tags every page shares: its canonical URL (so diuqbank.com's links,
 * `www.` and filtered views all count for one page) and the rest of its link
 * preview. Titles and descriptions come from each route (`pageMeta`).
 */
function SeoLinks({ origin }: { origin: string }) {
  const { pathname, search } = useLocation();
  const url = canonicalUrl(origin, pathname, search);
  // The deepest route's own image, if it has one.
  const image =
    useMatches()
      .map((m) => (m.handle as RouteHandle | undefined)?.ogImage)
      .filter(Boolean)
      .at(-1) ?? OG_IMAGE;
  return (
    <>
      <link rel="canonical" href={url} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:image" content={origin + image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
    </>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  // An error that reaches the root (e.g. a non-admin opening /admin) gets the site
  // chrome, even on a route that normally has its own shell.
  const error = useRouteError();
  const matches = useMatches();
  const space = useSpace()?.id;
  const { pathname } = useLocation();
  const ownShell =
    !error &&
    matches.some(
      (match) => (match.handle as RouteHandle | undefined)?.ownShell,
    );

  return (
    // THEME_SCRIPT adds the `dark` class before hydration.
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {analyticsEnabled && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            />
            <script dangerouslySetInnerHTML={{ __html: GTAG_SCRIPT }} />
          </>
        )}
        <Meta />
        {data && <SeoLinks origin={data.origin} />}
        <Links />
      </head>
      <body
        data-space={space}
        className="min-h-dvh bg-background font-sans text-foreground antialiased"
      >
        <SkipLink />
        <TopLoader />
        {ownShell ? (
          children
        ) : (
          <div className="flex min-h-dvh flex-col">
            <SiteHeader
              user={data?.user ?? null}
              needsAttention={data?.needsAttention ?? 0}
            />
            <AndroidBetaStrip />
            <PageTransition className="@container/main container flex-1 py-8">
              {children}
            </PageTransition>
            <footer className="mt-12 bg-surface-low">
              <div className="container grid gap-10 py-12 md:grid-cols-[1fr_auto]">
                <div className="max-w-sm space-y-3">
                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 font-expressive text-xl text-primary transition-opacity hover:opacity-80"
                  >
                    <GraduationCap className="size-6" aria-hidden />
                    OurDIU
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    Free forever, no ads. Built by a DIU student, with papers
                    shared by DIU students.
                  </p>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <span>
                      Made with ☕ by{" "}
                      <Link
                        to="/about"
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {AUTHOR.firstName}
                      </Link>
                    </span>
                    {AUTHOR.links.map(({ network, label, href }) => (
                      <a
                        key={network}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${AUTHOR.firstName} on ${label}`}
                        className="flex size-9 items-center justify-center rounded-full transition-colors hover:state-layer hover:text-foreground"
                      >
                        <SocialIcon network={network} className="size-4" />
                      </a>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3 sm:gap-14">
                  <FooterColumn
                    title="Products"
                    links={PRODUCTS.map(({ href, name }) => ({
                      to: href,
                      label: name,
                    }))}
                  />
                  <FooterColumn
                    title="About"
                    links={[
                      { to: "/about", label: "About" },
                      { to: "/contact", label: "Contact" },
                      { to: "/app", label: "Get the app" },
                      { to: "/admission", label: "Admission guide" },
                    ]}
                  />
                  <FooterColumn
                    title="Legal"
                    links={LEGAL_PAGES.map(({ path, label }) => ({
                      to: path,
                      label,
                    }))}
                  />
                </div>
              </div>
            </footer>
            {productAt(pathname)?.id === "routine" && <RoutineBottomBar />}
          </div>
        )}
        <Toaster position="top-center" />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { to: string; label: string }[];
}) {
  return (
    <nav aria-label={title} className="space-y-3">
      <h2 className="font-semibold">{title}</h2>
      <ul className="space-y-2.5">
        {links.map(({ to, label }) => (
          <li key={to}>
            <Link
              to={to}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function App() {
  usePageViews();
  useRememberSpace();
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const space = useSpace();
  let title = "Something went wrong";
  let details = "An unexpected error occurred. Please try again.";
  let stack: string | undefined;
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  if (isRouteErrorResponse(error)) {
    title = notFound ? "Page not found" : `Error ${error.status}`;
    details = notFound
      ? "We couldn't find what you were looking for."
      : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <div className="space-y-6 py-8">
      <EmptyState
        icon={notFound ? FileQuestion : TriangleAlert}
        title={title}
        description={details}
        action={
          <Link to={space?.href ?? "/"} className={buttonVariants()}>
            {space ? `Back to ${space.name}` : "Back to home"}
          </Link>
        }
      />
      {stack && (
        <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-left text-xs">
          <code>{stack}</code>
        </pre>
      )}
    </div>
  );
}
