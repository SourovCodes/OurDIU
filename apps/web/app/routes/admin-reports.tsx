import type {
  AdminReport,
  AdminReportList,
  ReportStatus,
} from "@ourdiu/shared";
import {
  REPORT_HIDE_THRESHOLD,
  REPORT_STATUSES,
} from "@ourdiu/shared/constants";
import {
  CircleCheck,
  CircleDashed,
  EllipsisVertical,
  Eye,
  EyeOff,
  Flag,
  RotateCcw,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useFormAction } from "~/components/actions";
import { AdminPageHeader } from "~/components/admin/admin-header";
import {
  ReportStatusBadge,
  SubmissionStatusBadge,
} from "~/components/admin/badges";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  adminSubmissionUrl,
  classificationLine,
  REPORT_STATUS_LABELS,
} from "~/lib/admin";
import { adminGetJson, adminRequest } from "~/lib/admin.server";
import { formatDate } from "~/lib/dates";
import { REPORT_REASON_LABELS } from "~/lib/engagement";
import type { Route } from "./+types/admin-reports";

export const handle = { breadcrumb: "Reports" };

export const meta: Route.MetaFunction = () => [
  { title: "Reports — Admin — OurDIU" },
  { name: "robots", content: "noindex" },
];

const PAGE_SIZE = 20;

/** `?status=` filter: open reports by default, or `all`. */
function parseStatus(value: string | null): ReportStatus | "all" {
  if (value === "all") return "all";
  return REPORT_STATUSES.find((s) => s === value) ?? "pending";
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const status = parseStatus(url.searchParams.get("status"));
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  if (status !== "all") query.set("status", status);

  const list = await adminGetJson<AdminReportList>(
    request,
    `/reports?${query}`,
  );
  return { list, status };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  return adminRequest(
    request,
    "report",
    "PATCH",
    `/reports/${encodeURIComponent(String(form.get("reportId")))}`,
    { status: form.get("status") },
  );
}

export { AdminRouteError as ErrorBoundary };

const SUCCESS: Record<ReportStatus, string> = {
  resolved: "Report resolved",
  dismissed: "Report dismissed",
  pending: "Report reopened",
};

function RowActions({
  report,
  run,
}: {
  report: AdminReport;
  run: ReturnType<typeof useFormAction>["run"];
}) {
  const update = (status: ReportStatus) =>
    run({ reportId: String(report.id), status }, SUCCESS[status]);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground data-[state=open]:bg-muted"
          aria-label={`Actions for report ${report.id}`}
          onClick={(event) => event.stopPropagation()}
        >
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-44"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem asChild>
          <Link to={adminSubmissionUrl(report.submission.id)}>
            <Eye />
            Review paper
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {report.status === "pending" ? (
          <>
            <DropdownMenuItem onSelect={() => update("resolved")}>
              <CircleCheck />
              Resolve
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => update("dismissed")}>
              <CircleDashed />
              Dismiss
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onSelect={() => update("pending")}>
            <RotateCcw />
            Reopen
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function AdminReports({ loaderData }: Route.ComponentProps) {
  const { list, status } = loaderData;
  const { counts } = list;
  const navigate = useNavigate();
  // Owned by the page: a resolved report leaves the open list, row and all.
  const { run } = useFormAction();

  const tabs = [
    ...REPORT_STATUSES.map((s) => ({
      value: s,
      label: REPORT_STATUS_LABELS[s],
      search: s === "pending" ? "" : `?status=${s}`,
      count: counts[s],
    })),
    {
      value: "all",
      label: "All",
      search: "?status=all",
      count: counts.pending + counts.resolved + counts.dismissed,
    },
  ];

  const hrefFor = (page: number) => {
    const params = new URLSearchParams();
    if (status !== "pending") params.set("status", status);
    if (page > 1) params.set("page", String(page));
    return `?${params}`;
  };

  return (
    <>
      <AdminPageHeader
        title="Reports"
        description={`Problems readers flagged on published papers. A paper is hidden at ${REPORT_HIDE_THRESHOLD} open reports; resolving reports doesn’t publish it again.`}
      />
      <UrlTabs label="Filter by status" tabs={tabs} value={status}>
        {list.items.length === 0 ? (
          <EmptyState
            icon={Flag}
            title={status === "pending" ? "No open reports" : "No reports here"}
            description={
              status === "pending"
                ? "When readers report a problem with a paper, it shows up here."
                : undefined
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Report</TableHead>
                  <TableHead className="hidden @3xl/main:table-cell">
                    Paper
                  </TableHead>
                  <TableHead className="hidden @5xl/main:table-cell">
                    Reporter
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.items.map((report) => {
                  const { submission } = report;
                  const hidden =
                    submission.status === "pending_review" &&
                    submission.pendingReportCount >= REPORT_HIDE_THRESHOLD;
                  return (
                    <TableRow
                      key={report.id}
                      className="cursor-pointer"
                      onClick={() =>
                        navigate(adminSubmissionUrl(submission.id))
                      }
                    >
                      <TableCell className="w-full max-w-0">
                        <p className="truncate font-medium">
                          {REPORT_REASON_LABELS[report.reason]}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {report.details ?? formatDate(report.createdAt)}
                        </p>
                      </TableCell>
                      <TableCell className="hidden max-w-64 @3xl/main:table-cell">
                        <div className="flex items-center gap-2">
                          <span className="truncate">
                            {submission.classification.course.name}
                          </span>
                          {hidden ? (
                            <Badge variant="outline" className="px-1.5">
                              <EyeOff />
                              Hidden
                            </Badge>
                          ) : (
                            <SubmissionStatusBadge status={submission.status} />
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {classificationLine(submission.classification)}
                        </p>
                      </TableCell>
                      <TableCell className="hidden @5xl/main:table-cell">
                        <div className="flex min-w-40 items-center gap-2">
                          <UserAvatar
                            name={report.reporter.name}
                            image={report.reporter.image}
                            className="size-6"
                          />
                          <div className="grid leading-tight">
                            <span className="max-w-40 truncate">
                              {report.reporter.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(report.createdAt)}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <ReportStatusBadge status={report.status} />
                      </TableCell>
                      <TableCell>
                        <RowActions report={report} run={run} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <TablePagination
          page={list.page}
          pageSize={list.pageSize}
          total={list.total}
          noun="report"
          hrefFor={hrefFor}
        />
      </UrlTabs>
    </>
  );
}
