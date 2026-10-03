import { ChevronDown, ScrollText } from "lucide-react";
import { cn } from "~/lib/utils";

/**
 * A paper's text as the AI read it off the PDF, folded under the paper. It's in the
 * page's HTML even while folded, so search engines find the questions on it.
 */
export function PaperText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <details
      className={cn("group rounded-3xl bg-surface", className)}
      data-testid="paper-text"
      // Opening it is the browser's job, so it may be open before React hydrates
      // (a tap on a slow phone); that isn't a mismatch to report.
      suppressHydrationWarning
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-3xl px-5 py-4 font-medium transition-colors hover:state-layer focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <ScrollText className="size-5 shrink-0 text-primary" aria-hidden />
        <span className="flex-1">Read the questions as text</span>
        <ChevronDown
          className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="space-y-4 px-5 pb-5">
        <p className="text-xs text-muted-foreground">
          Read off the PDF by AI, so it may have mistakes. The PDF is the
          original.
        </p>
        <div className="text-sm leading-7 break-words whitespace-pre-wrap">
          {text}
        </div>
      </div>
    </details>
  );
}
