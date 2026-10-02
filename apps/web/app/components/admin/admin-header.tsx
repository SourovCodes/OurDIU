import { ExternalLink } from "lucide-react";
import { Fragment } from "react";
import { Link, useMatches } from "react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { ThemeToggle } from "~/components/theme-toggle";

/**
 * Admin routes name themselves in the breadcrumb through their `handle`: a string,
 * or a function of the route's loader data.
 */
export type AdminHandle = {
  breadcrumb: string | ((data: unknown) => string);
};

function useBreadcrumbs() {
  return useMatches().flatMap((match) => {
    const handle = match.handle as Partial<AdminHandle> | undefined;
    if (!handle?.breadcrumb) return [];
    const label =
      typeof handle.breadcrumb === "function"
        ? handle.breadcrumb(match.loaderData)
        : handle.breadcrumb;
    return [{ label, to: match.pathname }];
  });
}

/** The inset's top bar: sidebar toggle, breadcrumbs, and a way back to the site. */
export function AdminHeader() {
  const crumbs = useBreadcrumbs();

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            {crumbs.map((crumb, i) => (
              <Fragment key={crumb.to}>
                {i > 0 && <BreadcrumbSeparator className="hidden md:block" />}
                <BreadcrumbItem
                  className={
                    i < crumbs.length - 1 ? "hidden md:inline-flex" : "min-w-0"
                  }
                >
                  {i < crumbs.length - 1 ? (
                    <BreadcrumbLink asChild>
                      <Link to={crumb.to}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="truncate">
                      {crumb.label}
                    </BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
            <Link to="/">
              <ExternalLink />
              View site
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

/** Admin pages use the site's page header; breadcrumbs live in the top bar. */
export { PageHeader as AdminPageHeader } from "~/components/page-header";
