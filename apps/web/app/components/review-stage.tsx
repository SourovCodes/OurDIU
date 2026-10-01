import type { MySubmission } from "@ourdiu/shared";
import { CircleCheck, Clock, LoaderCircle, TriangleAlert } from "lucide-react";
import { reviewStage, type ReviewStage } from "~/lib/review";
import { cn } from "~/lib/utils";

const TONE_CLASSES: Record<ReviewStage["tone"], string> = {
  progress: "text-sky-700 dark:text-sky-400",
  success: "text-emerald-700 dark:text-emerald-400",
  attention: "text-amber-700 dark:text-amber-400",
  neutral: "text-muted-foreground",
};

function ToneIcon({
  tone,
  className,
}: {
  tone: ReviewStage["tone"];
  className?: string;
}) {
  const classes = cn("size-4 shrink-0", className);
  switch (tone) {
    case "progress":
      return (
        <LoaderCircle className={cn(classes, "animate-spin")} aria-hidden />
      );
    case "success":
      return <CircleCheck className={classes} aria-hidden />;
    case "attention":
      return <TriangleAlert className={classes} aria-hidden />;
    case "neutral":
      return <Clock className={classes} aria-hidden />;
  }
}

/** Where the paper is in the review: an icon and a short label. */
export function ReviewStageLabel({
  submission,
  className,
}: {
  submission: MySubmission;
  className?: string;
}) {
  const { label, tone } = reviewStage(submission);
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-sm font-medium",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <ToneIcon tone={tone} />
      {label}
    </p>
  );
}

export { ToneIcon, TONE_CLASSES };
