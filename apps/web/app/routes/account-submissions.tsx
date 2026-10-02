import type {
  ApiError,
  MySubmission,
  MySubmissionList,
  SubmissionStatus,
} from "@ourdiu/shared";
import {
  EllipsisVertical,
  ExternalLink,
  FileUp,
  Globe,
  ListChecks,
  Trash2,
  Upload,
} from "lucide-react";
import { useState } from "react";
import {
  data,
  Link,
  useSearchParams,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import { ConfirmAction, useFormAction } from "~/components/actions";
import { EmptyState } from "~/components/empty-state";
import {
  MySubmissionCards,
  mySubmissionUrl,
} from "~/components/my-submission-cards";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { UrlTabs } from "~/components/url-tabs";
import type { ActionResult } from "~/lib/action-result";
import { apiFetch, apiGetJson, readJson } from "~/lib/api.server";
import { isChecking } from "~/lib/review";
import { useRefreshWhile } from "~/hooks/use-refresh-while";
import { requireUser } from "~/lib/session.server";
import {
  contributorUrl,
  ownSubmissionFileUrl,
  publicUrl,
  STATUS_LABELS,
} from "~/lib/submissions";
import { formatCount } from "~/lib/format";
import type { Route } from "./+types/account-submissions";

export const meta: Route.MetaFunction = () => [
  { title: "My submissions — OurDIU Question Bank" },
  { name: "robots", content: "noindex" },
];

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const { items } = await apiGetJson<MySubmissionList>(
    request,
    "/api/v1/me/submissions",
  );
  return { username: user.username ?? user.id, submissions: items };
}

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const id = String((await request.formData()).get("id") ?? "");
  const res = await apiFetch(
    request,
    `/api/v1/me/submissions/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  if (res.status === 204) {
    return data<ActionResult>({ ok: true, intent: "withdraw" });
  }

  const body = await readJson<ApiError>(res).catch(() => null);
  return data<ActionResult>(
    {
      ok: false,
      intent: "withdraw",
      error: body?.error.message ?? "Could not withdraw this submission.",
      fieldErrors: {},
    },
    { status: res.status },
  );
}

// The status filter is applied in the browser, so changing it needs no reload.
export function shouldRevalidate({
  formMethod,
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  return formMethod || currentUrl.pathname !== nextUrl.pathname
    ? defaultShouldRevalidate
    : false;
}

const FILTER_STATUSES: SubmissionStatus[] = [
  "published",
  "pending_review",
  "rejected",
];

/** Status, public page, PDF, and withdrawing while the paper isn't published. */
function CardActions({
  submission,
  run,
}: {
  submission: MySubmission;
  run: ReturnType<typeof useFormAction>["run"];
}) {
  const [withdrawing, setWithdrawing] = useState(false);
  const href = publicUrl(submission);
  const { course, semester, examType } = submission.classification;

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground data-[state=open]:state-layer"
            aria-label={`Actions for ${course.name}`}
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link to={mySubmissionUrl(submission.id)}>
              <ListChecks />
              Review status
            </Link>
          </DropdownMenuItem>
          {href && (
            <DropdownMenuItem asChild>
              <Link to={href}>
                <Globe />
                Public page
              </Link>
            </DropdownMenuItem>
          )}
          {/* A plain link: the PDF comes straight from the API, not a page route. */}
          <DropdownMenuItem asChild>
            <a
              href={ownSubmissionFileUrl(submission.id)}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink />
              Preview PDF
            </a>
          </DropdownMenuItem>
          {submission.status !== "published" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setWithdrawing(true)}
              >
                <Trash2 />
                Withdraw
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmAction
        open={withdrawing}
        onOpenChange={setWithdrawing}
        title="Withdraw this submission?"
        description={`${course.name} · ${semester.name} · ${examType.name}. The PDF is deleted and can’t be recovered.`}
        confirmLabel="Withdraw"
        destructive
        successMessage="Submission withdrawn"
        fields={{ id: String(submission.id) }}
        run={run}
      />
    </>
  );
}

export default function AccountSubmissions({
  loaderData,
}: Route.ComponentProps) {
  const { username, submissions } = loaderData;
  // Owned by the page: a withdrawn submission's row disappears.
  const { run } = useFormAction();
  // Keeps "Checking your paper" cards up to date.
  useRefreshWhile(submissions.some(isChecking));
  const [searchParams] = useSearchParams();
  const requested = searchParams.get("status");
  const status = FILTER_STATUSES.find((s) => s === requested) ?? null;
  const visible = status
    ? submissions.filter((s) => s.status === status)
    : submissions;

  const tabs = [
    { value: "all", label: "All", search: "", count: submissions.length },
    ...FILTER_STATUSES.map((s) => ({
      value: s,
      label: STATUS_LABELS[s],
      search: `?status=${s}`,
      count: submissions.filter((submission) => submission.status === s).length,
    })),
  ];

  // The actions share the row with the status tabs.
  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <h1 className="font-display-xl text-5xl sm:text-7xl">My submissions</h1>
        <p className="text-muted-foreground">
          The papers you’ve shared, and where each one is in review.
        </p>
      </div>
      {submissions.length > 0 && (
        <dl className="grid grid-cols-3 gap-2 sm:max-w-xl">
          {[
            {
              label: "published",
              value: submissions.filter((s) => s.status === "published").length,
            },
            {
              label: "in review",
              value: submissions.filter((s) => s.status === "pending_review")
                .length,
            },
            {
              label: "views",
              value: submissions.reduce((sum, s) => sum + s.viewCount, 0),
            },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="grid gap-0.5 rounded-2xl bg-primary-container px-4 py-3 text-primary-container-foreground"
            >
              <dd className="font-expressive text-2xl tabular-nums">
                {formatCount(value)}
              </dd>
              <dt className="text-xs font-medium opacity-80">{label}</dt>
            </div>
          ))}
        </dl>
      )}

      {submissions.length === 0 ? (
        <EmptyState
          icon={FileUp}
          title="No submissions yet"
          description="Upload a question paper and follow its review here: the AI check, and the admin’s decision when one is needed."
          action={
            <Button size="sm" asChild>
              <Link to="/questions/contribute">
                <Upload />
                Share a paper
              </Link>
            </Button>
          }
        />
      ) : (
        <UrlTabs
          label="Filter by status"
          tabs={tabs}
          value={status ?? "all"}
          toolbar={
            <>
              <Button variant="outline" size="sm" asChild>
                <Link to={contributorUrl(username)}>Public profile</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/questions/contribute">
                  <Upload />
                  Share a paper
                </Link>
              </Button>
            </>
          }
        >
          {visible.length === 0 ? (
            <EmptyState
              title={`No ${STATUS_LABELS[status!].toLowerCase()} submissions`}
            />
          ) : (
            <MySubmissionCards
              submissions={visible}
              actions={(submission) => (
                <CardActions submission={submission} run={run} />
              )}
            />
          )}
          <p className="px-1 text-xs text-muted-foreground">
            Open a paper to see what the AI read from it. Published papers can’t
            be withdrawn; contact an admin if one needs to be removed.
          </p>
        </UrlTabs>
      )}
    </section>
  );
}
