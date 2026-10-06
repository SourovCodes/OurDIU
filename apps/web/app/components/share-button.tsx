import { Share2 } from "lucide-react";
import { toast } from "~/lib/toast";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

/**
 * Shares the page: the device's share sheet where there is one (phones), otherwise
 * the link is copied.
 */
export function ShareButton({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  async function share() {
    const url = window.location.href.split("#")[0]!;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // Closed without sharing.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn’t copy the link");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Share"
      title="Share"
      onClick={share}
      className={cn("text-foreground", className)}
    >
      <Share2 aria-hidden />
    </Button>
  );
}
