import type { AdminReportList, AdminSubmissionList } from "@ourdiu/shared";
import {
  ArrowRight,
  CircleCheck,
  Flag,
  Inbox,
  Sparkles,
  Users,
} from "lucide-react";
import { Link, useNavigate, useRouteLoaderData } from "react-router";
import { AdminPageHeader } from "~/components/admin/admin-header";
import {
  EXAM_TONE,
  ExamBadge,
  ExamShape,
  type ExamKind,
} from "~/components/exam-badge";
import { AdminRouteError } from "~/components/admin/route-error";
import { StatusBreakdown } from "~/components/admin/status-breakdown";
import { UploadsChart } from "~/components/admin/uploads-chart";
import { UserAvatar } from "~/components/admin/user-avatar";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { adminSubmissionUrl, classificationLine } from "~/lib/admin";
import { adminGetJson } from "~/lib/admin.server";
import { formatDate } from "~/lib/dates";
import { REPORT_REASON_LABELS } from "~/lib/engagement";
import { formatCount } from "~/lib/format";
import { plural } from "~/lib/submissions";
import { cn } from "~/lib/utils";
import type { loader as adminLoader } from "./admin";
import type { Route } from "./+types/admin-dashboard";

export const handle = { breadcrumb: "Dashboard" };

export const meta: Route.MetaFunction = () => [
  { title: "Dashboard — Admin — OurDIU" },
  { name: "robots", content: "noindex" },
];

export async function loader({ request }: Route.LoaderArgs) {
  const [queue, reports] = await Promise.all([
    adminGetJson<AdminSubmissionList>(
      request,
      "/submissions?status=pending_review&pageSize=5",
    ),
    adminGetJson<AdminReportList>(
      request,
      "/reports?status=pending&pageSize=5",
    ),
  ]);
  return { queue: queue.items, reports: reports.items };
}

export { AdminRouteError as ErrorBoundary };

type StatCard = {
  label: string;
  value: number;
  icon: typeof Inbox;
  /** Short context under the number; omitted when there is nothing to say. */
  badge?: string;
  /** Something is waiting for an admin: the badge says so. */
  attention?: boolean;
  footer: string;
  detail: string;
  to: string;
  /** Its colour and shape, from the exam types, as the site's tiles. */
  tone: ExamKind;
};

/** The four numbers as tiles in the exam colours, each leading to its list. */
function SectionCards({ cards }: { cards: StatCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {cards.map((card) => (
        <Link
          key={card.label}
          to={card.to}
          className={cn(
            "group relative flex min-h-48 flex-col justify-between gap-6 overflow-hidden rounded-[1.75rem] p-5 transition-[scale] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98]",
            EXAM_TONE[card.tone],
          )}
        >
          <ExamShape
            kind={card.tone}
            colored={false}
            className="absolute -right-10 -bottom-12 size-44 opacity-[0.12] transition-transform duration-500 group-hover:rotate-12"
          />
          <div className="relative flex items-start justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <card.icon className="size-4" aria-hidden />
              {card.label}
            </span>
            {card.badge && (
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  card.attention
                    ? "bg-current/15"
                    : "bg-current/10 font-medium",
                )}
              >
                {card.badge}
              </span>
            )}
          </div>
          <div className="relative space-y-1">
            <p className="font-display-xl text-5xl tabular-nums">
              {formatCount(card.value)}
            </p>
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              {card.footer}
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </p>
            <p className="text-xs opacity-80">{card.detail}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function QueueCard({ queue }: { queue: AdminSubmissionList["items"] }) {
  const navigate = useNavigate();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Review queue</CardTitle>
        <CardDescription>Newest papers waiting for a decision</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/questions/submissions">View all</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {queue.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nothing to review. The queue is clear.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-surface-low">
            <Table>
              <TableHeader className="bg-surface-high">
                <TableRow>
                  <TableHead>Paper</TableHead>
                  <TableHead className="hidden @3xl/main:table-cell">
                    Uploader
                  </TableHead>
                  <TableHead className="text-right">Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((submission) => (
                  <TableRow
                    key={submission.id}
                    className="cursor-pointer"
                    onClick={() => navigate(adminSubmissionUrl(submission.id))}
                  >
                    <TableCell className="w-full max-w-0">
                      <div className="flex min-w-0 items-center gap-3">
                        <ExamBadge
                          examType={submission.classification.examType.name}
                          size={32}
                        />
                        <div className="min-w-0 flex-1">
                          <Link
                            to={adminSubmissionUrl(submission.id)}
                            className="block truncate font-medium hover:underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {submission.classification.course.name}
                          </Link>
                          <div className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                            {classificationLine(submission.classification)}
                            {submission.questionId === null && (
                              <Sparkles className="size-3 text-primary" />
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden @3xl/main:table-cell">
                      {submission.uploader?.name ?? "Deleted account"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatDate(submission.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReportsCard({ reports }: { reports: AdminReportList["items"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Open reports</CardTitle>
        <CardDescription>
          Problems readers flagged on published papers
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/questions/reports">View all</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {reports.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No open reports.
          </p>
        ) : (
          <ul className="grid gap-1">
            {reports.map((report) => (
              <li key={report.id}>
                <Link
                  to={adminSubmissionUrl(report.submission.id)}
                  className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-high"
                >
                  <UserAvatar
                    name={report.reporter.name}
                    image={report.reporter.image}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {REPORT_REASON_LABELS[report.reason]}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {report.submission.classification.course.name} ·{" "}
                      {report.reporter.name}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(report.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard({ loaderData }: Route.ComponentProps) {
  const { queue, reports } = loaderData;
  const { user, stats } =
    useRouteLoaderData<typeof adminLoader>("routes/admin")!;
  const { submissions, catalog } = stats;

  const cards: StatCard[] = [
    {
      label: "Pending review",
      value: submissions.pendingReview,
      icon: Inbox,
      badge:
        submissions.awaitingClassification > 0
          ? plural(submissions.awaitingClassification, "proposal")
          : undefined,
      attention: submissions.pendingReview > 0,
      footer:
        submissions.pendingReview > 0 ? "Review submissions" : "All caught up",
      detail: "Papers waiting for a decision",
      to: "/admin/questions/submissions",
      tone: "quiz",
    },
    {
      label: "Open reports",
      value: stats.openReports,
      icon: Flag,
      badge: stats.openReports > 0 ? "Needs action" : undefined,
      attention: stats.openReports > 0,
      footer: stats.openReports > 0 ? "Handle reports" : "No open reports",
      detail: "Papers hide at 3 open reports",
      to: "/admin/questions/reports",
      tone: "midterm",
    },
    {
      label: "Published",
      value: submissions.published,
      icon: CircleCheck,
      badge: plural(stats.questions, "question"),
      footer: "Browse published",
      detail: `${formatCount(stats.views)} views in total`,
      to: "/admin/questions/submissions?status=published",
      tone: "final",
    },
    {
      label: "Users",
      value: stats.users,
      icon: Users,
      badge: plural(stats.contributors, "contributor"),
      footer: "Manage users",
      detail: `${catalog.departments} departments · ${catalog.courses} courses`,
      to: "/admin/users",
      tone: "lab",
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        description={`Welcome back, ${user.name.split(" ")[0]}. Here’s what needs your attention.`}
      />
      <SectionCards cards={cards} />
      <div className="grid gap-4 @5xl/main:grid-cols-3">
        <div className="@5xl/main:col-span-2">
          <UploadsChart days={stats.dailySubmissions} />
        </div>
        <StatusBreakdown counts={submissions} />
      </div>
      <div className="grid gap-4 @5xl/main:grid-cols-2">
        <QueueCard queue={queue} />
        <ReportsCard reports={reports} />
      </div>
    </>
  );
}
