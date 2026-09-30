import "@fontsource-variable/inter";
// The one subset every page needs; the CSS alone would find it only after it loads.
import interLatin from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import { FileQuestion, TriangleAlert } from "lucide-react";
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
import { buttonVariants } from "~/components/ui/button";
import { TopLoader } from "~/components/top-loader";
import { Toaster } from "~/components/ui/sonner";
import { LEGAL_PAGES } from "~/lib/legal";
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
              <div className="container flex flex-col gap-3 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <p>OurDIU · Tools for DIU students, free and ad-free</p>
                <nav aria-label="Footer" className="flex flex-wrap gap-4">
                  <a
                    href="https://diuqbank.com"
                    className="hover:text-foreground"
                  >
                    Question Bank
                  </a>
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
