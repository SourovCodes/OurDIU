import "@fontsource-variable/inter";
// The one subset every page needs; the CSS alone would find it only after it loads.
import interLatin from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import { FileQuestion, GraduationCap, TriangleAlert } from "lucide-react";
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useMatches,
  useRouteError,
  useRouteLoaderData,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import type { Route } from "./+types/root";
import "./app.css";
import { EmptyState } from "~/components/empty-state";
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
import { PRODUCTS } from "~/lib/products";
import { getUser } from "~/lib/session.server";
import { THEME_SCRIPT } from "~/lib/theme";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  {
    rel: "preload",
    href: interLatin,
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  return { user: await getUser(request) };
}

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
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <TopLoader />
        {ownShell ? (
          children
        ) : (
          <div className="flex min-h-dvh flex-col">
            <SiteHeader user={data?.user ?? null} />
            <main className="@container/main container flex-1 py-8">
              {children}
            </main>
            <footer className="border-t">
              <div className="container grid gap-4 py-6 text-sm text-muted-foreground sm:grid-cols-[1fr_auto] sm:items-center">
                <p className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <GraduationCap className="size-3.5" aria-hidden />
                  </span>
                  OurDIU · Free forever, no ads
                </p>
                <nav aria-label="Footer" className="flex flex-wrap gap-4">
                  {PRODUCTS.map(({ id, href, name }) => (
                    <Link key={id} to={href} className="hover:text-foreground">
                      {name}
                    </Link>
                  ))}
                  <Link to="/app" className="hover:text-foreground">
                    Android app
                  </Link>
                  <Link to="/about" className="hover:text-foreground">
                    About
                  </Link>
                  <Link to="/contact" className="hover:text-foreground">
                    Contact
                  </Link>
                </nav>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:col-span-2 sm:justify-between">
                  <div className="flex items-center gap-2">
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
                        className="rounded-sm p-1 transition-colors hover:text-foreground"
                      >
                        <SocialIcon network={network} className="size-3.5" />
                      </a>
                    ))}
                  </div>
                  <nav aria-label="Legal" className="flex flex-wrap gap-4">
                    {LEGAL_PAGES.map(({ path, label }) => (
                      <Link
                        key={path}
                        to={path}
                        className="hover:text-foreground"
                      >
                        {label}
                      </Link>
                    ))}
                  </nav>
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
