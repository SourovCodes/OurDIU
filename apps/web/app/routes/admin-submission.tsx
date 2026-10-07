import type {
  AdminSubmissionDetail,
  AdminSubmissionReport,
  SubmissionAnalysis,
  SubmissionClassification,
  SubmissionStatus,
} from "@ourdiu/shared";
import { REPORT_HIDE_THRESHOLD } from "@ourdiu/shared/constants";
import {
  Bot,
  CircleCheck,
  CircleX,
  EllipsisVertical,
  ExternalLink,
  EyeOff,
  FilePen,
  Globe,
  MessagesSquare,
  LoaderCircle,
  Pencil,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Stamp,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TriangleAlert,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import { Link, redirect } from "react-router";
import {
  ActionDialog,
  ConfirmAction,
  useFormAction,
} from "~/components/actions";
import { AdminPageHeader } from "~/components/admin/admin-header";
import { ExamBadge } from "~/components/exam-badge";
import {
  RejectDialog,
  RequestChangesDialog,
} from "~/components/admin/reject-dialog";
import { ReviewThread } from "~/components/review-thread";
import {
  ReportStatusBadge,
  SubmissionFlags,
  SubmissionStatusBadge,
} from "~/components/admin/badges";
import { AdminRouteError } from "~/components/admin/route-error";
import { UserAvatar } from "~/components/admin/user-avatar";
import {
  ClassificationFields,
  defaultsFrom,
} from "~/components/classification-fields";
import { PaperDetailsFields } from "~/components/paper-details-fields";
import { PdfViewer } from "~/components/pdf-viewer";
import { useRefreshWhile } from "~/hooks/use-refresh-while";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Separator } from "~/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  adminSubmissionFileUrl,
  classificationLine,
  proposesNewEntries,
} from "~/lib/admin";
import { adminGetJson, adminRequest, formObject } from "~/lib/admin.server";
import {
  classificationFromAnalysis,
  compareWithAnalysis,
} from "~/lib/analysis";
import { formatDate } from "~/lib/dates";
import { REPORT_REASON_LABELS } from "~/lib/engagement";
import { formatBytes, formatCount } from "~/lib/format";
import { contributorUrl, STATUS_LABELS } from "~/lib/submissions";
import { invalidateTaxonomy, loadTaxonomy } from "~/lib/taxonomy.server";
import type { Route } from "./+types/admin-submission";

type LoaderData = Awaited<ReturnType<typeof loader>>;

export const handle = {
  breadcrumb: (data: unknown) =>
    (data as LoaderData | undefined)?.submission.classification.course.name ??
    "Submission",
};

export const meta: Route.MetaFunction = ({ loaderData }) => [
  {
    title: `${loaderData?.submission.classification.course.name ?? "Submission"} — Admin — OurDIU`,
  },
  { name: "robots", content: "noindex" },
];

export async function loader({ request, params }: Route.LoaderArgs) {
  const [submission, taxonomy] = await Promise.all([
    adminGetJson<AdminSubmissionDetail>(
      request,
      `/submissions/${encodeURIComponent(params.id)}`,
    ),
    // Fresh: classifying can add departments, courses and semesters.
    loadTaxonomy(request, { fresh: true }),
  ]);
  return { submission, taxonomy };
}

export async function action({ request, params }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const path = `/submissions/${encodeURIComponent(params.id)}`;

  switch (intent) {
    case "status":
      return adminRequest(request, intent, "PATCH", path, {
        status: form.get("status"),
        reason: form.get("reason") ?? undefined,
      });
    case "classify": {
      const result = await adminRequest(
        request,
        intent,
        "PUT",
        `${path}/classification`,
        formObject(form, "intent"),
      );
      // It may have created departments, courses or semesters.
      invalidateTaxonomy();
      return result;
    }
    case "message":
      return adminRequest(request, intent, "POST", `${path}/messages`, {
        body: form.get("body"),
      });
    case "analyze":
      return adminRequest(request, intent, "POST", `${path}/analysis`);
    case "watermark":
      return adminRequest(request, intent, "POST", `${path}/watermark`);
    case "report":
      return adminRequest(
        request,
        intent,
        "PATCH",
        `/reports/${encodeURIComponent(String(form.get("reportId")))}`,
        { status: form.get("status") },
      );
    case "delete": {
      const result = await adminRequest(request, intent, "DELETE", path);
      return result.data.ok ? redirect("/admin/questions/submissions") : result;
    }
    default:
      throw new Response("Unknown intent", { status: 400 });
  }
}

export { AdminRouteError as ErrorBoundary };

const SUCCESS: Record<SubmissionStatus, string> = {
  published: "Paper published",
  rejected: "Paper rejected",
  pending_review: "Moved back to review",
  changes_requested: "Changes requested",
};

/** Publish / reject / back-to-review buttons, plus a menu with the rest. */
function DecisionActions({
  submission,
}: {
  submission: AdminSubmissionDetail;
}) {
  const [deleting, setDeleting] = useState(false);
  const [rejecting, setRejecting] = useState<number>();
  const [requesting, setRequesting] = useState<number>();
  const needsClassification = submission.questionId === null;
  const { status } = submission;
  const { busy, pending, run } = useFormAction();
  const decide = (next: SubmissionStatus) => ({
    disabled: busy,
    onClick: () => run({ intent: "status", status: next }, SUCCESS[next]),
  });
  const deciding = pending?.get("status");

  const publish = (
    <Button
      {...decide("published")}
      size="sm"
      disabled={busy || needsClassification}
    >
      <CircleCheck />
      {deciding === "published" ? "Publishing…" : "Publish"}
    </Button>
  );

  return (
    <>
      {status !== "published" &&
        (needsClassification ? (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Disabled buttons don't fire pointer events; the span does. */}
              <span tabIndex={0}>{publish}</span>
            </TooltipTrigger>
            <TooltipContent>Approve the new entries first</TooltipContent>
          </Tooltip>
        ) : (
          publish
        ))}
      {status !== "published" && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => setRequesting(Date.now())}
        >
          <FilePen />
          {status === "changes_requested" ? "Ask again" : "Request changes"}
        </Button>
      )}
      {requesting !== undefined && (
        <RequestChangesDialog
          key={requesting}
          open
          onOpenChange={(open) => !open && setRequesting(undefined)}
        />
      )}
      {status !== "rejected" && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => setRejecting(Date.now())}
        >
          <CircleX />
          Reject
        </Button>
      )}
      {/* Outside the condition above: the paper is rejected by the time the
          dialog's result toast shows. Keyed per opening. */}
      {rejecting !== undefined && (
        <RejectDialog
          key={rejecting}
          open
          onOpenChange={(open) => !open && setRejecting(undefined)}
        />
      )}
      {status !== "pending_review" && (
        <Button {...decide("pending_review")} size="sm" variant="outline">
          <RotateCcw />
          Back to review
        </Button>
      )}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label="More actions">
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
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
          {submission.questionId !== null && status === "published" && (
            <DropdownMenuItem asChild>
              <Link
                to={`/questions/${submission.questionId}?submission=${encodeURIComponent(submission.id)}`}
              >
                <Globe />
                Open the public page
              </Link>
            </DropdownMenuItem>
          )}
          {status === "published" && (
            <DropdownMenuItem
              disabled={busy}
              onSelect={() =>
                run({ intent: "watermark" }, "Watermarking the public copy")
              }
            >
              <Stamp />
              {submission.watermark?.status === "done"
                ? "Redo the watermark"
                : "Watermark the PDF"}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleting(true)}
          >
            <Trash2 />
            Delete paper
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmAction
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this paper?"
        description={`${submission.classification.course.name} · ${classificationLine(submission.classification)}. The PDF, its votes and its reports are deleted for good.`}
        confirmLabel="Delete"
        destructive
        fields={{ intent: "delete" }}
      />
    </>
  );
}

type Taxonomy = LoaderData["taxonomy"];

/**
 * Files the paper under a department, course, semester and exam type, creating new
 * names. Opened with the current values, or with the AI's.
 */
function ClassifyDialog({
  taxonomy,
  classification,
  details,
  trigger,
  title,
  description,
  submitLabel,
  successMessage,
}: {
  taxonomy: Taxonomy;
  classification: SubmissionClassification;
  details: { section: string | null; batch: string | null };
  trigger: React.ReactElement;
  title: string;
  description: string;
  submitLabel: string;
  successMessage: string;
}) {
  return (
    <ActionDialog
      trigger={trigger}
      title={title}
      description={description}
      submitLabel={submitLabel}
      pendingLabel="Saving…"
      successMessage={successMessage}
      fields={{ intent: "classify" }}
      className="sm:max-w-2xl"
    >
      {(fieldErrors) => (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <ClassificationFields
            {...taxonomy}
            fieldErrors={fieldErrors}
            defaults={defaultsFrom(classification)}
            shortNameOptional={false}
          />
          <PaperDetailsFields fieldErrors={fieldErrors} defaults={details} />
        </div>
      )}
    </ActionDialog>
  );
}

function ClassificationCard({
  submission,
  taxonomy,
}: {
  submission: AdminSubmissionDetail;
  taxonomy: Taxonomy;
}) {
  const { department, course, semester, examType } = submission.classification;
  const proposes = proposesNewEntries(submission.classification);
  const rows = [
    {
      label: "Department",
      value: department.shortName
        ? `${department.name} (${department.shortName})`
        : department.name,
      isNew: department.id === null,
    },
    { label: "Course", value: course.name, isNew: course.id === null },
    { label: "Semester", value: semester.name, isNew: semester.id === null },
    { label: "Exam type", value: examType.name, isNew: false },
    { label: "Section", value: submission.section ?? "—", isNew: false },
    { label: "Batch", value: submission.batch ?? "—", isNew: false },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Classification</CardTitle>
        <CardAction>
          <ClassifyDialog
            taxonomy={taxonomy}
            classification={submission.classification}
            details={submission}
            trigger={
              <Button variant={proposes ? "default" : "outline"} size="sm">
                {proposes ? <Sparkles /> : <Pencil />}
                {proposes ? "Review entries" : "Edit"}
              </Button>
            }
            title={proposes ? "Approve new entries" : "Edit classification"}
            description={
              proposes
                ? "New names are added to the catalog when you save. Pick an existing entry instead if one already fits."
                : "Move this paper to another department, course, semester or exam type, or fix its section and batch."
            }
            submitLabel={proposes ? "Approve and save" : "Save"}
            successMessage={
              proposes ? "New entries approved" : "Classification saved"
            }
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 text-sm">
          {rows.map(({ label, value, isNew }) => (
            <div key={label} className="grid gap-0.5">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="flex items-center gap-2 font-medium">
                <span className="min-w-0 break-words">{value}</span>
                {isNew && <Badge variant="secondary">New</Badge>}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

const isChecking = (analysis: SubmissionAnalysis | null) =>
  analysis?.status === "queued" || analysis?.status === "processing";

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? (
        <CircleCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <TriangleAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      )}
      <span>{children}</span>
    </li>
  );
}

/** What the AI found: validity checks, and its values next to the submitted ones. */
function AnalysisCard({
  submission,
  taxonomy,
}: {
  submission: AdminSubmissionDetail;
  taxonomy: Taxonomy;
}) {
  const analysis = submission.analysisDetail;
  const { busy, run } = useFormAction();
  const checking = isChecking(analysis);
  useRefreshWhile(checking);

  const rows =
    analysis?.values && compareWithAnalysis(submission, analysis.values);
  const differs = rows?.some((row) => row.differs) ?? false;

  let description: string;
  if (!analysis) description = "This paper hasn’t been checked.";
  else if (checking) description = "Checking the paper…";
  else if (analysis.status === "failed") description = "The check failed.";
  else description = `Checked ${formatDate(analysis.completedAt!)}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="size-4" aria-hidden />
          AI check
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || checking}
            onClick={() => run({ intent: "analyze" }, "AI check started")}
          >
            {checking ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <RefreshCw />
            )}
            {analysis ? "Re-run" : "Run"}
          </Button>
        </CardAction>
      </CardHeader>
      {analysis && (analysis.error || analysis.status === "completed") && (
        <CardContent className="grid gap-4 text-sm">
          {analysis.error && (
            <p className="text-muted-foreground">{analysis.error}</p>
          )}
          {analysis.status === "completed" && rows && (
            <>
              <ul className="grid gap-1.5">
                <Check ok={analysis.isQuestionPaper === true}>
                  {analysis.isQuestionPaper
                    ? "A question paper"
                    : "Not a question paper"}
                </Check>
                {analysis.isQuestionPaper && (
                  <Check ok={analysis.paperCount === 1}>
                    {analysis.paperCount === 1
                      ? "A single paper"
                      : `${analysis.paperCount} papers in one file`}
                  </Check>
                )}
              </ul>
              {analysis.note && (
                <p className="border-l-2 pl-3 text-muted-foreground">
                  {analysis.note}
                </p>
              )}
              <Separator />
              <dl className="grid gap-3">
                {rows.map((row) => (
                  <div key={row.label} className="grid gap-0.5">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="grid gap-0.5">
                      <span className="font-medium break-words">
                        {row.submitted ?? "—"}
                      </span>
                      {row.ai === null ? (
                        <span className="text-xs text-muted-foreground">
                          AI: not found
                        </span>
                      ) : row.differs ? (
                        <span className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                          AI: {row.ai}
                          {row.aiIsNew && (
                            <Badge variant="secondary">New</Badge>
                          )}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CircleCheck className="size-3" aria-hidden />
                          AI agrees
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              {differs && (
                <ClassifyDialog
                  taxonomy={taxonomy}
                  classification={classificationFromAnalysis(
                    submission.classification,
                    analysis.values!,
                  )}
                  details={{
                    section: analysis.values!.section ?? submission.section,
                    batch: analysis.values!.batch ?? submission.batch,
                  }}
                  trigger={
                    <Button
                      size="sm"
                      variant="secondary"
                      className="justify-self-start"
                    >
                      <Wand2 />
                      Apply AI values
                    </Button>
                  }
                  title="Apply AI values"
                  description="The form is filled in with what the AI read from the paper. Check each field, pick existing entries where one fits, then save. New names are added to the catalog."
                  submitLabel="Save"
                  successMessage="Classification saved"
                />
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/** What the public downloads: the watermarked copy, or the original meanwhile. */
function publicCopyLabel({ status, watermark }: AdminSubmissionDetail) {
  switch (watermark?.status) {
    case "done":
      return `Watermarked, ${formatBytes(watermark.fileSize ?? 0)}`;
    case "queued":
      return "Watermarking…";
    case "failed":
      return "Original (watermark failed)";
    default:
      return status === "published" ? "Original (not watermarked)" : "—";
  }
}

function DetailsCard({ submission }: { submission: AdminSubmissionDetail }) {
  const { uploader, watermark } = submission;
  useRefreshWhile(watermark?.status === "queued");
  const details = [
    { label: "Uploaded", value: formatDate(submission.createdAt) },
    { label: "Last changed", value: formatDate(submission.updatedAt) },
    { label: "File size", value: formatBytes(submission.fileSize) },
    { label: "Views", value: formatCount(submission.viewCount) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {uploader ? (
          <Link
            to={contributorUrl(uploader.username)}
            className="-m-2 flex items-center gap-3 rounded-xl p-2 transition-colors hover:state-layer"
          >
            <UserAvatar name={uploader.name} image={uploader.image} />
            <div className="grid min-w-0 text-sm leading-tight">
              <span className="truncate font-medium">{uploader.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {uploader.email}
              </span>
            </div>
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">
            The uploader deleted their account.
          </p>
        )}
        <Separator />
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {details.map(({ label, value }) => (
            <div key={label} className="grid gap-0.5">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
          <div className="col-span-2 grid gap-0.5">
            <dt className="text-muted-foreground">Public download</dt>
            <dd className="font-medium">{publicCopyLabel(submission)}</dd>
            {watermark?.status === "failed" && watermark.error && (
              <dd className="text-xs break-words text-muted-foreground">
                {watermark.error}
              </dd>
            )}
          </div>
        </dl>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ThumbsUp className="size-4" aria-hidden />
            <span className="sr-only">Likes</span>
            {formatCount(submission.likeCount)}
          </span>
          <span className="flex items-center gap-1.5">
            <ThumbsDown className="size-4" aria-hidden />
            <span className="sr-only">Dislikes</span>
            {formatCount(submission.dislikeCount)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportItem({ report }: { report: AdminSubmissionReport }) {
  const { busy, run } = useFormAction();
  const update = (status: string, message: string) => ({
    size: "xs" as const,
    disabled: busy,
    onClick: () =>
      run({ intent: "report", reportId: String(report.id), status }, message),
  });

  return (
    <li className="grid gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">
          {REPORT_REASON_LABELS[report.reason]}
        </p>
        <ReportStatusBadge status={report.status} />
      </div>
      {report.details && (
        <p className="border-l-2 pl-3 text-sm text-muted-foreground">
          {report.details}
        </p>
      )}
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <UserAvatar
          name={report.reporter.name}
          image={report.reporter.image}
          className="size-5"
        />
        <span className="truncate">{report.reporter.name}</span>
        <span aria-hidden>·</span>
        <span className="shrink-0">{formatDate(report.createdAt)}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {report.status === "pending" ? (
          <>
            <Button
              {...update("resolved", "Report resolved")}
              variant="outline"
            >
              <CircleCheck />
              Resolve
            </Button>
            <Button
              {...update("dismissed", "Report dismissed")}
              variant="ghost"
            >
              Dismiss
            </Button>
          </>
        ) : (
          <Button {...update("pending", "Report reopened")} variant="ghost">
            <RotateCcw />
            Reopen
          </Button>
        )}
      </div>
    </li>
  );
}

export default function AdminSubmission({ loaderData }: Route.ComponentProps) {
  const { submission, taxonomy } = loaderData;
  const { classification } = submission;
  const openReports = submission.reports.filter((r) => r.status === "pending");
  const hiddenByReports =
    submission.status === "pending_review" &&
    submission.pendingReportCount >= REPORT_HIDE_THRESHOLD;
  const newEntries = [
    classification.department.id === null &&
      `department “${classification.department.name}”`,
    classification.course.id === null &&
      `course “${classification.course.name}”`,
    classification.semester.id === null &&
      `semester “${classification.semester.name}”`,
  ].filter(Boolean);
  const analysisFlag = submission.analysisDetail?.flag;

  return (
    <>
      <div className="flex items-start gap-4">
        <ExamBadge
          examType={classification.examType.name}
          size={56}
          className="mt-1 max-sm:hidden"
        />
        <div className="min-w-0 flex-1">
          <AdminPageHeader
            title={classification.course.name}
            description={`${classification.department.name} · ${classificationLine(classification)}`}
            actions={<DecisionActions submission={submission} />}
          >
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <SubmissionStatusBadge status={submission.status} />
              <SubmissionFlags {...submission} />
            </div>
          </AdminPageHeader>
        </div>
      </div>

      {submission.status === "rejected" && (
        <Alert variant="destructive">
          <CircleX />
          <AlertTitle>Rejected</AlertTitle>
          <AlertDescription className="grid gap-2">
            <p className="whitespace-pre-line">
              {submission.rejectionReason ?? "No reason was given."}
            </p>
            <RejectDialog
              defaultReason={submission.rejectionReason}
              trigger={
                <Button
                  size="sm"
                  variant="outline"
                  className="justify-self-start"
                >
                  <Pencil />
                  Change the reason
                </Button>
              }
            />
          </AlertDescription>
        </Alert>
      )}
      {submission.status === "changes_requested" && (
        <Alert variant="info">
          <FilePen />
          <AlertTitle>Waiting for the uploader’s changes</AlertTitle>
          <AlertDescription>
            The uploader can edit the details, replace the file and reply below.
            It comes back to the review queue when they resubmit it.
          </AlertDescription>
        </Alert>
      )}
      {newEntries.length > 0 && (
        <Alert variant="info">
          <Sparkles />
          <AlertTitle>This paper proposes new catalog entries</AlertTitle>
          <AlertDescription>
            The uploader added a new {newEntries.join(", ")}. Approve them, or
            pick existing entries, before publishing.
          </AlertDescription>
        </Alert>
      )}
      {analysisFlag && (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>
            {analysisFlag === "not_a_paper"
              ? "The AI doesn’t think this is a question paper"
              : "The AI found several question papers in this file"}
          </AlertTitle>
          <AlertDescription>
            {submission.analysisDetail?.note ??
              "Check the PDF before publishing."}
          </AlertDescription>
        </Alert>
      )}
      {hiddenByReports && (
        <Alert variant="warning">
          <EyeOff />
          <AlertTitle>
            Hidden after {submission.pendingReportCount} reports
          </AlertTitle>
          <AlertDescription>
            Resolve or dismiss the reports, then publish the paper again if it’s
            fine.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 items-start gap-4 @5xl/main:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-4">
          <PdfViewer
            src={adminSubmissionFileUrl(submission.id)}
            title={`${classification.course.name} — ${STATUS_LABELS[submission.status]}`}
          />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessagesSquare className="size-4" aria-hidden />
                Conversation with the uploader
              </CardTitle>
              <CardDescription>
                The uploader sees these messages as from “Reviewer”.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReviewThread
                messages={submission.messages}
                viewer="admin"
                unread={submission.adminUnread}
                canReply={submission.uploader !== null}
                placeholder="Ask the uploader something, or tell them what to fix"
                emptyText="No messages yet. Ask for changes, or write to the uploader below."
              />
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4">
          <AnalysisCard submission={submission} taxonomy={taxonomy} />
          <ClassificationCard submission={submission} taxonomy={taxonomy} />
          {submission.reports.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Reports</CardTitle>
                <CardDescription>
                  {openReports.length} open of {submission.reports.length}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {submission.reports.map((report) => (
                    <ReportItem key={report.id} report={report} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          <DetailsCard submission={submission} />
        </div>
      </div>
    </>
  );
}
