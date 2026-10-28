import { GraduationCap } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "~/components/ui/sheet";
import { trackEvent } from "~/lib/analytics";
import { declineApp, dismissAppSheet, openInAppUrl } from "~/lib/android-app";

/**
 * The "Open in the app" sheet, asked once of Android visitors (`AppSheet` decides
 * and loads it). Either answer, or closing it, keeps it away for good; choosing the
 * browser also counts as one "no" to the app (`declineApp`).
 */
export default function OpenInAppSheet({ path }: { path: string }) {
  const [open, setOpen] = useState(true);
  useEffect(() => trackEvent("app_sheet_shown"), []);

  const answer = (event: string) => {
    trackEvent(event);
    if (event === "app_sheet_browser") declineApp();
    dismissAppSheet();
    setOpen(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) answer("app_sheet_browser");
      }}
    >
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="gap-5 rounded-t-[1.75rem] px-6 pt-3 pb-7"
        data-testid="open-in-app-sheet"
      >
        <div
          aria-hidden
          className="h-1 w-8 self-center rounded-full bg-muted-foreground/40"
        />
        <div className="flex items-center gap-3.5">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <GraduationCap className="size-7" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[17px] font-bold">OurDIU</p>
            <p className="text-sm text-muted-foreground">Free on Google Play</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <SheetTitle className="font-expressive text-[1.625rem]">
            Better in the app
          </SheetTitle>
          <SheetDescription className="text-[15px] text-pretty">
            Save papers for exam week, read them full screen, and keep your
            class routine on your home screen.
          </SheetDescription>
        </div>
        <div className="flex flex-col gap-1">
          <a
            href={openInAppUrl(path, "app_sheet")}
            onClick={() => answer("app_sheet_open")}
            className={buttonVariants({
              size: "lg",
              className: "h-13 text-base",
            })}
          >
            Open in the app
          </a>
          <Button
            variant="ghost"
            size="lg"
            className="text-primary"
            onClick={() => answer("app_sheet_browser")}
          >
            Continue in browser
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
