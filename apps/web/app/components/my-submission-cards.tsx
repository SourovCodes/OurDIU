import type { MySubmission } from "@ourdiu/shared";
import { CalendarDays, Eye, ThumbsUp } from "lucide-react";
import { Link } from "react-router";
import {
  CARD_GRID,
  LINK_CARD,
  STRETCHED_LINK,
} from "~/components/question-cards";
import { ReviewStageLabel } from "~/components/review-stage";
import { StatusBadge } from "~/components/status-badge";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { formatDate } from "~/lib/dates";
import { formatCount } from "~/lib/format";
import { paperDetails } from "~/lib/submissions";

export const mySubmissionUrl = (id: number) =>
  `/questions/my-submissions/${id}`;

function MySubmissionCard({
  submission,
  actions,
}: {
  submission: MySubmission;
  actions?: React.ReactNode;
}) {
  const details = paperDetails(submission);
  const { department, course, semester, examType } = submission.classification;

  return (
    <Card className={LINK_CARD}>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={submission.status} />
          <Badge variant="secondary" title={department.name}>
            {department.shortName ?? department.name}
          </Badge>
          <Badge variant="outline" className="text-muted-foreground">
            {examType.name}
          </Badge>
        </div>
        {/* Above the stretched link, so the menu stays clickable. */}
        {actions && (
          <CardAction className="relative z-10">{actions}</CardAction>
        )}
        <CardTitle className="text-base leading-snug">
          <Link
            to={mySubmissionUrl(submission.id)}
            prefetch="intent"
            className={STRETCHED_LINK}
          >
            {course.name}
          </Link>
        </CardTitle>
        <CardDescription className="flex items-center gap-1.5">
          <CalendarDays className="size-3.5" aria-hidden />
          {semester.name}
          {details && ` · ${details}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ReviewStageLabel submission={submission} />
      </CardContent>
      <CardFooter className="mt-auto justify-between gap-3 border-t text-sm text-muted-foreground [.border-t]:pt-4">
        <span>Added {formatDate(submission.createdAt)}</span>
        {submission.status === "published" && (
          <span className="flex items-center gap-3 tabular-nums">
            <span className="flex items-center gap-1">
              <ThumbsUp className="size-4" aria-hidden />
              {formatCount(submission.likeCount)}
              <span className="sr-only"> likes</span>
            </span>
            <span className="flex items-center gap-1">
              <Eye className="size-4" aria-hidden />
              {formatCount(submission.viewCount)}
              <span className="sr-only"> views</span>
            </span>
          </span>
        )}
      </CardFooter>
    </Card>
  );
}

/** The signed-in user's own papers as cards; each opens its status page. */
export function MySubmissionCards({
  submissions,
  actions,
}: {
  submissions: MySubmission[];
  actions?: (submission: MySubmission) => React.ReactNode;
}) {
  return (
    <ul aria-label="My submissions" className={CARD_GRID}>
      {submissions.map((submission) => (
        <li key={submission.id} className="grid">
          <MySubmissionCard
            submission={submission}
            actions={actions?.(submission)}
          />
        </li>
      ))}
    </ul>
  );
}
