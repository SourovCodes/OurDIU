import { Outlet } from "react-router";
import { AdminHeader, type AdminHandle } from "~/components/admin/admin-header";
import { AdminSidebar } from "~/components/admin/app-sidebar";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { TooltipProvider } from "~/components/ui/tooltip";
import { requireAdmin } from "~/lib/session.server";
import type { RouteHandle } from "~/root";
import type { Route } from "./+types/admin";

export const handle: RouteHandle & AdminHandle = {
  ownShell: true,
  breadcrumb: "Admin",
};

export const meta: Route.MetaFunction = () => [
  { title: "Admin — OurDIU" },
  { name: "robots", content: "noindex" },
];

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAdmin(request);
  // The sidebar remembers whether it was collapsed in a cookie; read it so the
  // server renders the same state.
  const sidebarOpen = !/(?:^|;\s*)sidebar_state=false/.test(
    request.headers.get("cookie") ?? "",
  );
  return { user, sidebarOpen };
}

/** The admin panel's own shell: shadcn sidebar plus an inset with a top bar. */
export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const { user, sidebarOpen } = loaderData;

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider
        defaultOpen={sidebarOpen}
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 64)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AdminSidebar variant="inset" user={user} />
        <SidebarInset>
          <AdminHeader />
          <div className="@container/main flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
