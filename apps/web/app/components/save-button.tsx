import { Bookmark } from "lucide-react";
import { Link, useFetcher, useLocation } from "react-router";
import { buttonVariants } from "~/components/ui/button";
import type { PaperActionResult } from "~/lib/engagement";
import { cn } from "~/lib/utils";

/**
 * Saves a question to the visitor's account, the same list as the app's Saved
 * tab. Signed out, it asks them to log in first. Posts to the question page's
 * action, so it works from any page.
 */
export function SaveButton({
  questionId,
  saved,
  signedIn,
  label = false,
  className,
}: {
  questionId: number;
  saved: boolean;
  signedIn: boolean;
  /** Show "Save"/"Saved" next to the icon. */
  label?: boolean;
  className?: string;
}) {
  const location = useLocation();
  const fetcher = useFetcher<PaperActionResult>({ key: `save-${questionId}` });
  // Shows the new state straight away; the loader catches up after revalidation.
  const pending = fetcher.formData?.get("saved");
  const on = pending ? pending === "true" : saved;
  const classes = cn(
    buttonVariants({
      variant: on ? "secondary" : "outline",
      size: label ? "default" : "icon",
    }),
    !on && "text-foreground",
    className,
  );
  const icon = <Bookmark className={cn(on && "fill-current")} aria-hidden />;

  if (!signedIn) {
    return (
      <Link
        to={`/login?redirectTo=${encodeURIComponent(location.pathname + location.search)}`}
        aria-label={label ? undefined : "Log in to save"}
        className={classes}
      >
        {icon}
        {label && "Save"}
      </Link>
    );
  }

  return (
    <fetcher.Form method="post" action={`/questions/${questionId}`}>
      <input type="hidden" name="intent" value="save" />
      <button
        type="submit"
        name="saved"
        value={on ? "false" : "true"}
        aria-pressed={on}
        aria-label={label ? undefined : on ? "Saved" : "Save"}
        title={on ? "Remove from saved" : "Save for later"}
        className={classes}
      >
        {icon}
        {label && (on ? "Saved" : "Save")}
      </button>
    </fetcher.Form>
  );
}
