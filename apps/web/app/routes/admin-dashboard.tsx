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
import { AdminRouteError } from "~/components/admin/route-error";
import { StatusBreakdown } from "~/components/admin/status-breakdown";
import { UploadsChart } from "~/components/admin/uploads-chart";
import { UserAvatar } from "~/components/admin/user-avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
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
  /** Short context beside the label; omitted when there is nothing to say. */
  badge?: string;
  /** Amber badge: something is waiting for an admin. */
  attention?: boolean;
  footer: string;
  detail: string;
  to: string;
};

function SectionCards({ cards }: { cards: StatCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {cards.map((card) => (
        <Card key={card.label} className="@container/card">
          <CardHeader>
            <CardDescription>{card.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {formatCount(card.value)}
            </CardTitle>
            {card.badge && (
              <CardAction>
                <Badge
                  variant="outline"
                  className={
                    card.attention
                      ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
                      : undefined
                  }
                >
                  <card.icon />
                  {card.badge}
                </Badge>
              </CardAction>
            )}
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <Link
              to={card.to}
              className="line-clamp-1 flex items-center gap-2 font-medium hover:underline"
            >
              {card.footer} <ArrowRight className="size-4" />
            </Link>
            <div className="text-muted-foreground">{card.detail}</div>
          </CardFooter>
        </Card>
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
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted">
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
                  className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted"
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
    },
    {
      label: "Published",
      value: submissions.published,
      icon: CircleCheck,
      badge: plural(stats.questions, "question"),
      footer: "Browse published",
      detail: `${formatCount(stats.views)} views in total`,
      to: "/admin/questions/submissions?status=published",
    },
    {
      label: "Users",
      value: stats.users,
      icon: Users,
      badge: plural(stats.contributors, "contributor"),
      footer: "Manage users",
      detail: `${catalog.departments} departments · ${catalog.courses} courses`,
      to: "/admin/users",
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
