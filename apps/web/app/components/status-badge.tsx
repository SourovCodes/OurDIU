import type { SubmissionStatus } from "@ourdiu/shared";
import { CircleCheck, CircleX, Clock } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { STATUS_LABELS } from "~/lib/submissions";

const STATUS_ICONS: Record<SubmissionStatus, React.ReactNode> = {
  published: (
    <CircleCheck className="fill-emerald-500 text-white dark:fill-emerald-400 dark:text-background" />
  ),
  pending_review: <Clock className="text-amber-600 dark:text-amber-400" />,
  rejected: (
    <CircleX className="fill-red-500 text-white dark:fill-red-400 dark:text-background" />
  ),
};

/** A submission's status, in the outline-badge-with-icon style of shadcn tables. */
export function StatusBadge({ status }: { status: SubmissionStatus }) {
  return (
    <Badge variant="outline" className="px-1.5 text-muted-foreground">
      {STATUS_ICONS[status]}
      {STATUS_LABELS[status]}
    </Badge>
  );
}
