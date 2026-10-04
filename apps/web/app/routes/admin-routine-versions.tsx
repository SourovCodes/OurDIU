import type {
  AdminRoutineVersion,
  AdminRoutineVersionList,
} from "@ourdiu/shared";
import {
  CalendarClock,
  Download,
  EllipsisVertical,
  Eye,
  Radio,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ConfirmAction, useFormAction } from "~/components/actions";
import { AdminPageHeader } from "~/components/admin/admin-header";
import { AdminRouteError } from "~/components/admin/route-error";
import {
  DELETE_DESCRIPTION,
  RoutineStatusBadge,
  UploadRoutineDialog,
  versionPdfHref,
  versionUrl,
} from "~/components/admin/routine";
import { EmptyState } from "~/components/empty-state";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { adminGetJson } from "~/lib/admin.server";
import { formatDate } from "~/lib/dates";
import { formatNumber } from "~/lib/format";
import { routineAdminAction } from "~/lib/routine-admin.server";
import type { Route } from "./+types/admin-routine-versions";

export const handle = { breadcrumb: "Routine versions" };

export const meta: Route.MetaFunction = () => [
  { title: "Routine versions — Admin — OurDIU" },
  { name: "robots", content: "noindex" },
];

export async function loader({ request }: Route.LoaderArgs) {
  return adminGetJson<AdminRoutineVersionList>(request, "/routine/versions");
}

export const action = ({ request }: Route.ActionArgs) =>
  routineAdminAction(request);

export { AdminRouteError as ErrorBoundary };

/** "live 24 Sep – 2 Oct", "since 2 Oct" */
function liveSpan(v: AdminRoutineVersion) {
  if (v.status === "live" && v.liveAt) return `since ${formatDate(v.liveAt)}`;
  if (v.liveAt && v.replacedAt) {
    return `live ${formatDate(v.liveAt)} – ${formatDate(v.replacedAt)}`;
  }
  return null;
}

function RowActions({
  version,
  run,
}: {
  version: AdminRoutineVersion;
  run: ReturnType<typeof useFormAction>["run"];
}) {
  const [confirm, setConfirm] = useState<"live" | "delete" | null>(null);
  const name = `v${version.version}`;
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground data-[state=open]:state-layer"
            aria-label={`Actions for ${name}`}
            onClick={(event) => event.stopPropagation()}
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-52"
          onClick={(event) => event.stopPropagation()}
        >
          <DropdownMenuItem asChild>
            <Link to={versionUrl(version.id)}>
              <Eye />
              Review
            </Link>
          </DropdownMenuItem>
          {version.status !== "live" && (
            <DropdownMenuItem onSelect={() => setConfirm("live")}>
              <Radio />
              Make live
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <a href={versionPdfHref(version)} download>
              <Download />
              Download DIU’s PDF
            </a>
          </DropdownMenuItem>
          {version.status !== "live" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setConfirm("delete")}
              >
                <Trash2 />
                Delete version
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Dialogs render in a portal, but React still passes their clicks up to the
          row, which would open the version. */}
      <div className="contents" onClick={(event) => event.stopPropagation()}>
        <ConfirmAction
          open={confirm === "live"}
          onOpenChange={(open) => !open && setConfirm(null)}
          title={`Make ${name} live?`}
          description={`Students will see ${version.department} routine ${name} straight away. The live version becomes a previous one, which you can make live again.`}
          confirmLabel="Make live"
          successMessage={`${name} is live`}
          fields={{ intent: "live", id: String(version.id) }}
          run={run}
        />
        <ConfirmAction
          open={confirm === "delete"}
          onOpenChange={(open) => !open && setConfirm(null)}
          title={`Delete ${name}?`}
          description={DELETE_DESCRIPTION}
          confirmLabel="Delete"
          destructive
          successMessage={`${name} deleted`}
          fields={{ intent: "delete", id: String(version.id) }}
          run={run}
        />
      </div>
    </>
  );
}

export default function AdminRoutineVersions({
  loaderData,
}: Route.ComponentProps) {
  const { items } = loaderData;
  const navigate = useNavigate();
  // Owned by the page: a deleted version takes its row with it.
  const { run } = useFormAction();

  return (
    <>
      <AdminPageHeader
        title="Routine versions"
        description="Upload a department’s routine PDF as DIU publishes it; it’s read and kept as a draft. Review it, then make it live: students only see the live version, one per department."
        actions={
          <>
            <UploadRoutineDialog />
          </>
        }
      />
      {items.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No routine yet"
          description={
            <ol className="mx-auto mt-1 grid max-w-md list-decimal gap-1 pl-5 text-left">
              <li>
                Upload the department’s routine PDF (CSE’s or EEE’s) as DIU
                publishes it. It’s read, checked and kept as a draft.
              </li>
              <li>
                Add course titles and teachers’ details, which the PDFs don’t
                have, on{" "}
                <Link
                  to="/admin/routine/courses"
                  className="text-primary underline"
                >
                  Course titles
                </Link>{" "}
                and{" "}
                <Link
                  to="/admin/routine/teachers"
                  className="text-primary underline"
                >
                  Teachers
                </Link>
                .
              </li>
              <li>
                Review it, preview a section, and make it live. Until then the
                Class Routine says it’s coming soon.
              </li>
            </ol>
          }
          action={<UploadRoutineDialog />}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-surface-low">
          <Table>
            <TableHeader className="bg-surface-high">
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead className="hidden @3xl/main:table-cell">
                  Uploaded
                </TableHead>
                <TableHead className="hidden @xl/main:table-cell">
                  In it
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((v) => (
                <TableRow
                  key={v.id}
                  className="cursor-pointer"
                  onClick={() => navigate(versionUrl(v.id))}
                >
                  <TableCell>
                    <Link
                      to={versionUrl(v.id)}
                      className="font-semibold"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {v.department} v{v.version}
                    </Link>
                    {v.publishedOn && (
                      <p className="text-xs text-muted-foreground">
                        Published {formatDate(v.publishedOn)}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="hidden @3xl/main:table-cell">
                    {formatDate(v.createdAt)}
                    {v.uploadedBy && (
                      <p className="text-xs text-muted-foreground">
                        by {v.uploadedBy.name}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="hidden tabular-nums @xl/main:table-cell">
                    {formatNumber(v.sectionCount)} sections ·{" "}
                    {formatNumber(v.classCount)} classes
                    {v.warningCount > 0 && (
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        {v.warningCount} warning
                        {v.warningCount === 1 ? "" : "s"}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <RoutineStatusBadge status={v.status} />
                    {liveSpan(v) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {liveSpan(v)}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <RowActions version={v} run={run} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
