import type { AdminUser, AdminUserList } from "@ourdiu/shared";
import {
  EllipsisVertical,
  Search,
  ShieldCheck,
  ShieldOff,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { Form, useRouteLoaderData } from "react-router";
import { ConfirmAction } from "~/components/actions";
import { AdminPageHeader } from "~/components/admin/admin-header";
import { AdminRouteError } from "~/components/admin/route-error";
import { TablePagination } from "~/components/table-pagination";
import { UrlTabs } from "~/components/url-tabs";
import { UserAvatar } from "~/components/user-avatar";
import { EmptyState } from "~/components/empty-state";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { adminGetJson, adminRequest } from "~/lib/admin.server";
import { formatDate } from "~/lib/dates";
import type { loader as adminLoader } from "./admin";
import type { Route } from "./+types/admin-users";

export const handle = { breadcrumb: "Users" };

export const meta: Route.MetaFunction = () => [
  { title: "Users — Admin — OurDIU" },
  { name: "robots", content: "noindex" },
];

const PAGE_SIZE = 25;

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const role = url.searchParams.get("role") === "admin" ? "admin" : null;
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  if (q) query.set("q", q);
  if (role) query.set("role", role);

  const [list, admins] = await Promise.all([
    adminGetJson<AdminUserList>(request, `/users?${query}`),
    // Only the total, for the tab count.
    adminGetJson<AdminUserList>(request, "/users?role=admin&pageSize=1"),
  ]);
  return { list, q, role, adminCount: admins.total };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  return adminRequest(
    request,
    "role",
    "PATCH",
    `/users/${encodeURIComponent(String(form.get("id")))}`,
    { role: form.get("role") },
  );
}

export { AdminRouteError as ErrorBoundary };

function RowActions({ user }: { user: AdminUser }) {
  const [confirming, setConfirming] = useState(false);
  const makeAdmin = user.role !== "admin";

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground data-[state=open]:bg-muted"
            aria-label={`Actions for ${user.name}`}
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            variant={makeAdmin ? "default" : "destructive"}
            onSelect={() => setConfirming(true)}
          >
            {makeAdmin ? <ShieldCheck /> : <ShieldOff />}
            {makeAdmin ? "Make admin" : "Remove admin"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmAction
        open={confirming}
        onOpenChange={setConfirming}
        title={
          makeAdmin
            ? `Make ${user.name} an admin?`
            : `Remove ${user.name}’s admin rights?`
        }
        description={
          makeAdmin
            ? "Admins can manage every OurDIU product, the departments and other admins."
            : "They keep their account, but lose access to the admin panel right away."
        }
        confirmLabel={makeAdmin ? "Make admin" : "Remove admin"}
        destructive={!makeAdmin}
        successMessage={
          makeAdmin
            ? `${user.name} is now an admin`
            : `${user.name} is no longer an admin`
        }
        fields={{ id: user.id, role: makeAdmin ? "admin" : "user" }}
      />
    </>
  );
}

export default function AdminUsers({ loaderData }: Route.ComponentProps) {
  const { list, q, role, adminCount } = loaderData;
  const { user: me } = useRouteLoaderData<typeof adminLoader>("routes/admin")!;
  const withQuery = (params: Record<string, string>) => {
    const search = new URLSearchParams(params);
    if (q) search.set("q", q);
    const text = search.toString();
    return text ? `?${text}` : "";
  };

  const tabs = [
    { value: "all", label: "Everyone", search: withQuery({}) },
    {
      value: "admin",
      label: "Admins",
      search: withQuery({ role: "admin" }),
      count: adminCount,
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Users"
        description="Everyone with an OurDIU account, newest first. Grant admin rights to people you trust."
      />
      <UrlTabs
        label="Filter by role"
        tabs={tabs}
        value={role ?? "all"}
        toolbar={
          <Form role="search" className="relative w-full sm:w-72">
            {role && <input type="hidden" name="role" value={role} />}
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              key={q}
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search name or email…"
              aria-label="Search users"
              className="h-8 pl-8"
            />
          </Form>
        }
      >
        {list.items.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title={q ? `No users match “${q}”` : "No users yet"}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden @3xl/main:table-cell">
                    Joined
                  </TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.items.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="w-full max-w-0">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={user.name} image={user.image} />
                        <div className="grid min-w-0 leading-tight">
                          <span className="truncate font-medium">
                            {user.name}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            @{user.username} · {user.email}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.role === "admin" ? (
                        <Badge variant="secondary">
                          <ShieldCheck />
                          Admin
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground"
                        >
                          Member
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground @3xl/main:table-cell">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell>
                      {user.id === me.id ? (
                        <span className="px-2 text-xs text-muted-foreground">
                          You
                        </span>
                      ) : (
                        <RowActions user={user} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <TablePagination
          page={list.page}
          pageSize={list.pageSize}
          total={list.total}
          noun="user"
          hrefFor={(page) =>
            withQuery({
              ...(role ? { role } : {}),
              ...(page > 1 ? { page: String(page) } : {}),
            })
          }
        />
      </UrlTabs>
    </>
  );
}
