import type { SubmissionStatus } from "@ourdiu/shared";
import { CircleCheck, CircleX, Clock, FilePen } from "lucide-react";
import { STATUS_LABELS } from "~/lib/submissions";
import { cn } from "~/lib/utils";

const STATUS_STYLES: Record<
  SubmissionStatus,
  { icon: typeof Clock; className: string }
> = {
  published: {
    icon: CircleCheck,
    className:
      "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  },
  pending_review: {
    icon: Clock,
    className:
      "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  rejected: {
    icon: CircleX,
    className: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  },
  changes_requested: {
    icon: FilePen,
    className: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  },
};

/**
 * A submission's status as a tonal chip: green published, amber in review, blue waiting
 * for the uploader's changes, red not approved.
 */
export function StatusBadge({
  status,
  className,
}: {
  status: SubmissionStatus;
  className?: string;
}) {
  const { icon: Icon, className: tone } = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 rounded-full py-0.5 pr-2.5 pl-1.5 text-xs font-semibold whitespace-nowrap",
        tone,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}
