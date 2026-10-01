import type {
  AdminSubmission,
  AdminSubmissionList,
  AnalysisFilter,
  SubmissionStatus,
} from "@ourdiu/shared";
import {
  ANALYSIS_FILTERS,
  SUBMISSION_STATUSES,
} from "@ourdiu/shared/constants";
import {
  Bot,
  CircleCheck,
  CircleX,
  EllipsisVertical,
  ExternalLink,
  Eye,
  Inbox,
  Stamp,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ConfirmAction, useFormAction } from "~/components/actions";
import { AdminPageHeader } from "~/components/admin/admin-header";
import { RejectDialog } from "~/components/admin/reject-dialog";
import {
  AnalysisBadge,
  SubmissionFlags,
  SubmissionStatusBadge,
} from "~/components/admin/badges";
import { AdminRouteError } from "~/components/admin/route-error";
import { TablePagination } from "~/components/table-pagination";
import { UrlTabs } from "~/components/url-tabs";
import { UserAvatar } from "~/components/admin/user-avatar";
import { EmptyState } from "~/components/empty-state";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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
  adminSubmissionFileUrl,
  adminSubmissionUrl,
  classificationLine,
} from "~/lib/admin";
import { adminGetJson, adminRequest } from "~/lib/admin.server";
import { ANALYSIS_FILTER_LABELS } from "~/lib/analysis";
import { formatDate } from "~/lib/dates";
import { STATUS_LABELS } from "~/lib/submissions";
import type { Route } from "./+types/admin-submissions";

export const handle = { breadcrumb: "Submissions" };

export const meta: Route.MetaFunction = () => [
  { title: "Submissions — Admin — OurDIU" },
  { name: "robots", content: "noindex" },
];

const PAGE_SIZE = 20;

/** `?status=` filter: pending review by default (the queue), or `all`. */
function parseStatus(value: string | null): SubmissionStatus | "all" {
  if (value === "all") return "all";
  return SUBMISSION_STATUSES.find((s) => s === value) ?? "pending_review";
}

/** `?ai=` filter on the AI analysis; none by default. */
function parseAiFilter(value: string | null): AnalysisFilter | null {
  return ANALYSIS_FILTERS.find((f) => f === value) ?? null;
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const status = parseStatus(url.searchParams.get("status"));
  const ai = parseAiFilter(url.searchParams.get("ai"));
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  if (status !== "all") query.set("status", status);
  if (ai) query.set("ai", ai);

  const list = await adminGetJson<AdminSubmissionList>(
    request,
    `/submissions?${query}`,
  );
  return { list, status, ai };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent"));
  if (intent === "watermark-missing") {
    return adminRequest(request, intent, "POST", "/submissions/watermark");
  }
  if (intent === "check-unchecked") {
    return adminRequest(request, intent, "POST", "/submissions/analysis");
  }
  throw new Response("Unknown intent", { status: 400 });
}

export { AdminRouteError as ErrorBoundary };

type Run = ReturnType<typeof useFormAction>["run"];

/** Review, open the PDF, and quick decisions, posted to the review page's action. */
function RowActions({
  submission,
  run,
  onReject,
}: {
  submission: AdminSubmission;
  run: Run;
  /** Rejecting asks for a reason, in a dialog the page owns. */
  onReject: () => void;
}) {
  const publish = () =>
    run(
      { intent: "status", status: "published" },
      "Paper published",
      adminSubmissionUrl(submission.id),
    );

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground data-[state=open]:bg-muted"
          aria-label={`Actions for ${submission.classification.course.name}`}
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
          <Link to={adminSubmissionUrl(submission.id)}>
            <Eye />
            Review
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={adminSubmissionFileUrl(submission.id)}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink />
            Open PDF
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={
            submission.status === "published" || submission.questionId === null
          }
          onSelect={publish}
        >
          <CircleCheck />
          Publish
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          disabled={submission.status === "rejected"}
          onSelect={onReject}
        >
          <CircleX />
          Reject
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function AdminSubmissions({ loaderData }: Route.ComponentProps) {
  const { list, status, ai } = loaderData;
  const { counts } = list;
  const navigate = useNavigate();
  // Owned by the page: a published or rejected paper leaves the pending list, row
  // and all, which would take a dialog or toast of its own with it.
  const { run } = useFormAction();
  // Keyed per opening, so each one starts from a fresh dialog.
  const [rejecting, setRejecting] = useState<{ id: number; key: number }>();

  /** Search string for a status, AI filter and page, leaving out the defaults. */
  const searchFor = (
    next: { status?: string; ai?: AnalysisFilter | null; page?: number } = {},
  ) => {
    const params = new URLSearchParams();
    const nextStatus = next.status ?? status;
    const nextAi = next.ai === undefined ? ai : next.ai;
    if (nextStatus !== "pending_review") params.set("status", nextStatus);
    if (nextAi) params.set("ai", nextAi);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    return `?${params}`;
  };

  // Status counts don't take the AI filter into account.
  const tabs = [
    {
      value: "pending_review",
      label: STATUS_LABELS.pending_review,
      search: searchFor({ status: "pending_review" }),
      count: ai ? undefined : counts.pendingReview,
    },
    {
      value: "published",
      label: STATUS_LABELS.published,
      search: searchFor({ status: "published" }),
      count: ai ? undefined : counts.published,
    },
    {
      value: "rejected",
      label: STATUS_LABELS.rejected,
      search: searchFor({ status: "rejected" }),
      count: ai ? undefined : counts.rejected,
    },
    {
      value: "all",
      label: "All",
      search: searchFor({ status: "all" }),
      count: ai
        ? undefined
        : counts.published + counts.pendingReview + counts.rejected,
    },
  ];

  const hrefFor = (page: number) => searchFor({ page });

  const aiFilter = (
    <Select
      value={ai ?? "any"}
      onValueChange={(value) =>
        navigate(
          { search: searchFor({ ai: parseAiFilter(value) }) },
          { preventScrollReset: true },
        )
      }
    >
      <SelectTrigger size="sm" className="w-fit" aria-label="Filter by AI">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="any">Any AI result</SelectItem>
        {ANALYSIS_FILTERS.map((filter) => (
          <SelectItem key={filter} value={filter}>
            {ANALYSIS_FILTER_LABELS[filter]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <>
      <AdminPageHeader
        title="Submissions"
        description="Review uploaded papers. Reported papers are listed first."
        actions={
          <>
            <ConfirmAction
              trigger={
                <Button variant="outline" size="sm">
                  <Bot />
                  Check unchecked papers
                </Button>
              }
              title="Run the AI check on unchecked papers?"
              description="Pending papers that were never checked, such as imported ones, get the same check as a new upload: papers it confirms are published. Up to 100 at a time."
              confirmLabel="Check"
              successMessage="AI check started"
              fields={{ intent: "check-unchecked" }}
            />
            <ConfirmAction
              trigger={
                <Button variant="outline" size="sm">
                  <Stamp />
                  Watermark missing PDFs
                </Button>
              }
              title="Watermark published papers?"
              description="Published papers without a watermarked copy, or whose watermark failed, get one in the background. The public downloads the original until it's ready."
              confirmLabel="Watermark"
              successMessage="Watermarking started"
              fields={{ intent: "watermark-missing" }}
            />
          </>
        }
      />
      <UrlTabs
        label="Filter by status"
        tabs={tabs}
        value={status}
        toolbar={aiFilter}
      >
        {list.items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={
              status === "pending_review" && !ai
                ? "Nothing to review"
                : "No submissions here"
            }
            description={
              ai
                ? "No papers with this status match the AI filter."
                : status === "pending_review"
                  ? "New uploads show up here."
                  : undefined
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Paper</TableHead>
                  <TableHead className="hidden @3xl/main:table-cell">
                    Uploader
                  </TableHead>
                  <TableHead className="hidden @xl/main:table-cell">
                    Submitted
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.items.map((submission) => (
                  <TableRow
                    key={submission.id}
                    className="cursor-pointer"
                    onClick={() => navigate(adminSubmissionUrl(submission.id))}
                  >
                    <TableCell className="w-full max-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <Link
                          to={adminSubmissionUrl(submission.id)}
                          prefetch="intent"
                          className="max-w-full truncate font-medium hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {submission.classification.course.name}
                        </Link>
                        <SubmissionFlags {...submission} />
                        {submission.analysis && (
                          <AnalysisBadge analysis={submission.analysis} />
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {classificationLine(submission.classification)}
                      </p>
                    </TableCell>
                    <TableCell className="hidden @3xl/main:table-cell">
                      {submission.uploader ? (
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            name={submission.uploader.name}
                            image={submission.uploader.image}
                            className="size-6"
                          />
                          <span className="max-w-40 truncate">
                            {submission.uploader.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          Deleted account
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground @xl/main:table-cell">
                      {formatDate(submission.createdAt)}
                    </TableCell>
                    <TableCell>
                      <SubmissionStatusBadge status={submission.status} />
                    </TableCell>
                    <TableCell>
                      <RowActions
                        submission={submission}
                        run={run}
                        onReject={() =>
                          setRejecting({ id: submission.id, key: Date.now() })
                        }
                      />
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
          noun="submission"
          hrefFor={hrefFor}
        />
      </UrlTabs>
      {rejecting && (
        <RejectDialog
          key={rejecting.key}
          open
          onOpenChange={(open) => !open && setRejecting(undefined)}
          action={adminSubmissionUrl(rejecting.id)}
        />
      )}
    </>
  );
}
