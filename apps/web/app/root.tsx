// Roboto Flex, as in the app: the weight and width axes (headings are wide).
import "@fontsource-variable/roboto-flex/standard.css";
// The one subset every page needs; the CSS alone would find it only after it loads.
import robotoFlexLatin from "@fontsource-variable/roboto-flex/files/roboto-flex-latin-standard-normal.woff2?url";
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
import { AndroidBetaStrip } from "~/components/android-beta";
import { SiteHeader } from "~/components/site-header";
import { SocialIcon } from "~/components/social-icons";
import { buttonVariants } from "~/components/ui/button";
import { TopLoader } from "~/components/top-loader";
import { Toaster } from "~/components/ui/sonner";
import {
  analyticsEnabled,
  GA_MEASUREMENT_ID,
  GTAG_SCRIPT,
  usePageViews,
} from "~/lib/analytics";
import { AUTHOR } from "~/lib/author";
import { LEGAL_PAGES } from "~/lib/legal";
import { PRODUCTS, productAt } from "~/lib/products";
import { getUser } from "~/lib/session.server";
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

export async function loader({ request }: Route.LoaderArgs) {
  return { user: await getUser(request) };
}
export type RootLoader = typeof loader;

// The session only changes through form actions (log in, sign up, log out), so
// plain navigations don't need to re-fetch it.
export function shouldRevalidate({
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  return formMethod ? defaultShouldRevalidate : false;
}

/** Set `handle = { ownShell: true }` on a route that brings its own shell (the admin panel). */
export type RouteHandle = { ownShell?: boolean };

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  // An error that reaches the root (e.g. a non-admin opening /admin) gets the site
  // chrome, even on a route that normally has its own shell.
  const error = useRouteError();
  const matches = useMatches();
  const space = productAt(useLocation().pathname)?.id;
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
        <Links />
      </head>
      <body
        data-space={space}
        className="min-h-dvh bg-background font-sans text-foreground antialiased"
      >
        <TopLoader />
        {ownShell ? (
          children
        ) : (
          <div className="flex min-h-dvh flex-col">
            <SiteHeader user={data?.user ?? null} />
            <AndroidBetaStrip />
            <main className="@container/main container flex-1 py-8">
              {children}
            </main>
            <footer className="mt-12 bg-surface-low">
              <div className="container grid gap-10 py-12 md:grid-cols-[1fr_auto]">
                <div className="max-w-sm space-y-3">
                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 font-expressive text-xl text-primary"
                  >
                    <GraduationCap className="size-6" aria-hidden />
                    OurDIU
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    Free forever, no ads. Built by a DIU student; not an
                    official university service.
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
                        className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-accent hover:text-foreground"
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
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
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
          <Link
            to="/"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Back to home
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
