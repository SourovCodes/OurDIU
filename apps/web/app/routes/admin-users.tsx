import type { AdminUser, AdminUserList } from "@ourdiu/shared";
import {
  AtSign,
  EllipsisVertical,
  FileText,
  Search,
  ShieldCheck,
  ShieldOff,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { Form, Link, useRouteLoaderData } from "react-router";
import { USERNAME_RULES } from "@ourdiu/shared/constants";
import { ActionDialog, ConfirmAction } from "~/components/actions";
import { FormField } from "~/components/form";
import { AdminPageHeader } from "~/components/admin/admin-header";
import { AdminRouteError } from "~/components/admin/route-error";
import { TablePagination } from "~/components/table-pagination";
import { UrlTabs } from "~/components/url-tabs";
import { UserAvatar } from "~/components/admin/user-avatar";
import { EmptyState } from "~/components/empty-state";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { contributorUrl } from "~/lib/submissions";

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
  if (form.get("intent") === "username") {
    return adminRequest(
      request,
      "username",
      "PUT",
      `/users/${encodeURIComponent(String(form.get("id")))}/username`,
      { username: form.get("username") },
    );
  }
  return adminRequest(
    request,
    "role",
    "PATCH",
    `/users/${encodeURIComponent(String(form.get("id")))}`,
    { role: form.get("role") },
  );
}

export { AdminRouteError as ErrorBoundary };

function PaperCounts({ counts }: { counts: AdminUser["submissionCounts"] }) {
  const total = counts.published + counts.pendingReview + counts.rejected;
  if (total === 0) return <span className="text-muted-foreground">—</span>;
  const parts = [
    { label: "published", value: counts.published, dot: "bg-emerald-500" },
    {
      label: "pending review",
      value: counts.pendingReview,
      dot: "bg-amber-500",
    },
    { label: "rejected", value: counts.rejected, dot: "bg-red-500" },
  ];
  return (
    <span className="flex items-center gap-3 tabular-nums">
      {parts.map(({ label, value, dot }) => (
        <span key={label} title={label} className="flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${dot}`} aria-hidden />
          {value}
          <span className="sr-only">{label}</span>
        </span>
      ))}
    </span>
  );
}

function RowActions({ user }: { user: AdminUser }) {
  const [confirming, setConfirming] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const makeAdmin = user.role !== "admin";
  const hasPapers =
    user.submissionCounts.published +
      user.submissionCounts.pendingReview +
      user.submissionCounts.rejected >
    0;

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground data-[state=open]:state-layer"
            aria-label={`Actions for ${user.name}`}
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {hasPapers && (
            <>
              <DropdownMenuItem asChild>
                <Link to={contributorUrl(user.username)}>
                  <FileText />
                  View papers
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onSelect={() => setRenaming(true)}>
            <AtSign />
            Edit username
          </DropdownMenuItem>
          <DropdownMenuItem
            variant={makeAdmin ? "default" : "destructive"}
            onSelect={() => setConfirming(true)}
          >
            {makeAdmin ? <ShieldCheck /> : <ShieldOff />}
            {makeAdmin ? "Make admin" : "Remove admin"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ActionDialog
        open={renaming}
        onOpenChange={setRenaming}
        title={`Change ${user.name}’s username`}
        description={`It’s in their public profile’s address: /contributors/<username>. ${USERNAME_RULES}.`}
        submitLabel="Save"
        pendingLabel="Saving…"
        successMessage="Username changed"
        fields={{ intent: "username", id: user.id }}
      >
        {(fieldErrors) => (
          <FormField
            label="Username"
            name="username"
            defaultValue={user.username}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
            minLength={3}
            maxLength={50}
            error={fieldErrors.username}
          />
        )}
      </ActionDialog>
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
            ? "Admins can publish, reject and delete papers, handle reports, edit the catalog and manage other admins."
            : "They keep their account and papers, but lose access to the admin panel right away."
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
        description="Everyone with an account, newest first. Grant admin rights to people you trust to moderate."
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
          <div className="overflow-hidden rounded-2xl bg-surface-low">
            <Table>
              <TableHeader className="bg-surface-high">
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden @xl/main:table-cell">
                    Papers
                  </TableHead>
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
                    <TableCell className="hidden @xl/main:table-cell">
                      <PaperCounts counts={user.submissionCounts} />
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
