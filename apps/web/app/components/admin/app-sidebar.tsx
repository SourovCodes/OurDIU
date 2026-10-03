import {
  CalendarClock,
  FileJson,
  GraduationCap,
  EllipsisVertical,
  ExternalLink,
  Flag,
  FolderTree,
  Inbox,
  LayoutDashboard,
  LogOut,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation, useSubmit } from "react-router";
import { UserAvatar } from "~/components/admin/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "~/components/ui/sidebar";
import type { SessionUser } from "~/lib/types";

type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Items waiting for an admin. */
  badge?: number;
};

function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  const { pathname } = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const isActive = (url: string) =>
    url === "/admin" ? pathname === url : pathname.startsWith(url);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                asChild
                isActive={isActive(item.url)}
                tooltip={item.title}
              >
                <Link
                  to={item.url}
                  prefetch="intent"
                  onClick={() => isMobile && setOpenMobile(false)}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
              {item.badge ? (
                <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
              ) : null}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function NavUser({ user }: { user: SessionUser }) {
  const { isMobile } = useSidebar();
  const submit = useSubmit();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label="Account menu"
              className="data-[state=open]:state-layer data-[state=open]:text-sidebar-accent-foreground"
            >
              <UserAvatar
                name={user.name}
                image={user.image}
                className="rounded-full"
              />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
              <EllipsisVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <UserAvatar
                  name={user.name}
                  image={user.image}
                  className="rounded-lg"
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/account">
                <UserRound />
                Account settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/">
                <ExternalLink />
                View site
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                submit(
                  { redirectTo: "/" },
                  { method: "post", action: "/logout" },
                )
              }
            >
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

type AdminSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user: SessionUser;
  counts: { pendingReview: number; openReports: number };
};

export function AdminSidebar({ user, counts, ...props }: AdminSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/admin">
                <div className="flex aspect-square size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <GraduationCap className="size-5" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-expressive text-lg text-primary">
                    OurDIU
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    Admin panel
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup
          label="Overview"
          items={[{ title: "Dashboard", url: "/admin", icon: LayoutDashboard }]}
        />
        {/* One group per product; platform pieces (users) last. */}
        <NavGroup
          label="Question Bank"
          items={[
            {
              title: "Submissions",
              url: "/admin/questions/submissions",
              icon: Inbox,
              badge: counts.pendingReview,
            },
            {
              title: "Reports",
              url: "/admin/questions/reports",
              icon: Flag,
              badge: counts.openReports,
            },
            {
              title: "Catalog",
              url: "/admin/questions/catalog",
              icon: FolderTree,
            },
          ]}
        />
        <NavGroup
          label="Class Routine"
          items={[
            {
              title: "Versions",
              url: "/admin/routine/versions",
              icon: CalendarClock,
            },
            {
              title: "File format",
              url: "/admin/routine/format",
              icon: FileJson,
            },
          ]}
        />
        <NavGroup
          label="Platform"
          items={[{ title: "Users", url: "/admin/users", icon: Users }]}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
