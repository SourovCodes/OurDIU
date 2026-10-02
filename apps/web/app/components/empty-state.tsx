import type { LucideIcon } from "lucide-react";
import { ExamShape, type ExamKind } from "~/components/exam-badge";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { cn } from "~/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** The exam shape behind the icon, as in the app's state messages. */
  shape?: ExamKind;
  className?: string;
};

/**
 * shadcn's Empty on a tonal surface, where the list would be; the icon sits on
 * an exam shape, like the app's state messages.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  shape = "final",
  className,
}: EmptyStateProps) {
  return (
    <Empty className={cn("rounded-[1.75rem] bg-surface-low", className)}>
      <EmptyHeader>
        {Icon && (
          <EmptyMedia className="relative size-20">
            <ExamShape
              kind={shape}
              colored={false}
              className="absolute inset-0 size-full text-primary-container"
            />
            <Icon
              className="relative size-8 text-primary-container-foreground"
              aria-hidden
            />
          </EmptyMedia>
        )}
        <EmptyTitle className="font-expressive text-xl">{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
