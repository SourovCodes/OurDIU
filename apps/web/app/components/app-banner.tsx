import { GraduationCap } from "lucide-react";
import { useLocation } from "react-router";
import { buttonVariants } from "~/components/ui/button";
import { trackEvent } from "~/lib/analytics";
import { appPathFor, openInAppUrl, showsAppBanner } from "~/lib/android-app";

/**
 * A slim bar under the header that always offers Android visitors the app. Rendered
 * for everyone and shown by app.css only under `html[data-android]` (set by
 * ANDROID_SCRIPT before the first paint), so the HTML is the same for everyone and
 * nothing moves when the page loads. The link opens the same page in the app, or
 * Google Play without it (`openInAppUrl`).
 */
export function AppBanner() {
  const { pathname, search } = useLocation();
  if (!showsAppBanner(pathname)) return null;
  return (
    <aside
      aria-label="The OurDIU app"
      data-app-banner
      className="border-b bg-surface-low"
    >
      <div className="container flex items-center gap-3 py-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <GraduationCap className="size-5" aria-hidden />
        </span>
        <p className="min-w-0 flex-1 text-sm leading-tight">
          <span className="block font-semibold">OurDIU app</span>
          <span className="block text-muted-foreground">
            Free on Google Play
          </span>
        </p>
        <a
          href={openInAppUrl(appPathFor(pathname, search), "app_banner")}
          onClick={() => trackEvent("app_banner_open")}
          className={buttonVariants({ size: "sm", className: "shrink-0" })}
        >
          Get the app
        </a>
      </div>
    </aside>
  );
}
