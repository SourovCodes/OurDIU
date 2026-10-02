import { FileQuestion, Search } from "lucide-react";
import { data, Link } from "react-router";
import { CourseSearchTrigger } from "~/components/course-search";
import { EmptyState } from "~/components/empty-state";
import { buttonVariants } from "~/components/ui/button";
import { useSpace } from "~/lib/use-space";
import type { Route } from "./+types/not-found";

export const meta: Route.MetaFunction = () => [
  { title: "Page not found — OurDIU" },
  { name: "robots", content: "noindex" },
];

// A matched catch-all rather than root's ErrorBoundary, so the page can set its
// own title and so the dev server collects root's CSS (it derives the critical
// stylesheet from the matched routes, and an unmatched path matches none).
export function loader() {
  return data(null, { status: 404 });
}

export default function NotFound() {
  // Back to the space the visitor was in, e.g. the Question Bank for an old link.
  const space = useSpace();
  return (
    <EmptyState
      className="min-h-[60svh] bg-transparent"
      icon={FileQuestion}
      title="Page not found"
      description={`The link may be old, or the page may have moved.${space ? ` ${space.name} is still a click away.` : ""}`}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          {space?.id === "questions" && (
            <CourseSearchTrigger
              className={buttonVariants({ variant: "outline" })}
            >
              <Search aria-hidden />
              Search courses
            </CourseSearchTrigger>
          )}
          <Link to={space?.href ?? "/"} className={buttonVariants()}>
            {space ? `Back to ${space.name}` : "Back to home"}
          </Link>
        </div>
      }
    />
  );
}
