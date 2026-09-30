import { FileQuestion, TriangleAlert } from "lucide-react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { EmptyState } from "~/components/empty-state";
import { Button } from "~/components/ui/button";

/** Error boundary for admin pages, rendered inside the admin shell. */
export function AdminRouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <EmptyState
      icon={notFound ? FileQuestion : TriangleAlert}
      title={notFound ? "Not found" : "Something went wrong"}
      description={
        notFound
          ? "This record doesn’t exist, or it was deleted."
          : "The page couldn’t be loaded. Please try again."
      }
      action={
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin">Back to the dashboard</Link>
        </Button>
      }
    />
  );
}
