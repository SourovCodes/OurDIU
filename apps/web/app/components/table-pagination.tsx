import { formatNumber } from "~/lib/format";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Link } from "react-router";
import { Button, buttonVariants } from "~/components/ui/button";
import { pageItems } from "~/lib/pagination";
import { cn } from "~/lib/utils";

type TablePaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  /** Noun for the count, e.g. "submission". */
  noun: string;
  hrefFor: (page: number) => string;
};

function StepButton({
  to,
  label,
  children,
}: {
  to: string | null;
  label: string;
  children: React.ReactNode;
}) {
  return to ? (
    <Button variant="ghost" size="icon-sm" asChild>
      <Link to={to} aria-label={label} preventScrollReset>
        {children}
      </Link>
    </Button>
  ) : (
    <Button variant="ghost" size="icon-sm" disabled aria-label={label}>
      {children}
    </Button>
  );
}

/**
 * Footer under a list or table: the item count, and numbered page links with
 * previous/next, e.g. ‹ 1 … 4 5 6 … 82 ›. Links, so paging works without JS.
 */
export function TablePagination({
  page,
  pageSize,
  total,
  noun,
  hrefFor,
}: TablePaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-col items-center gap-3 px-1 sm:flex-row sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {total === 0
          ? `No ${noun}s`
          : `${formatNumber(from)}–${formatNumber(to)} of ${formatNumber(total)} ${total === 1 ? noun : `${noun}s`}`}
      </p>
      {pages > 1 && (
        <nav aria-label="Pagination">
          <ul className="flex items-center gap-1">
            <li>
              <StepButton
                to={page > 1 ? hrefFor(page - 1) : null}
                label="Previous page"
              >
                <ChevronLeft />
              </StepButton>
            </li>
            {pageItems(page, pages).map((item) =>
              typeof item === "number" ? (
                <li key={item}>
                  <Link
                    to={hrefFor(item)}
                    preventScrollReset
                    aria-label={`Page ${item}`}
                    aria-current={item === page ? "page" : undefined}
                    className={cn(
                      buttonVariants({
                        variant: item === page ? "outline" : "ghost",
                        size: "sm",
                      }),
                      "min-w-8 px-2 tabular-nums",
                    )}
                  >
                    {item}
                  </Link>
                </li>
              ) : (
                <li key={item} aria-hidden>
                  <span className="flex size-8 items-center justify-center text-muted-foreground">
                    <MoreHorizontal className="size-4" />
                  </span>
                </li>
              ),
            )}
            <li>
              <StepButton
                to={page < pages ? hrefFor(page + 1) : null}
                label="Next page"
              >
                <ChevronRight />
              </StepButton>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
