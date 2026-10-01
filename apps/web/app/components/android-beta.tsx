import { ArrowRight, Smartphone, X } from "lucide-react";
import { useCallback, useState, useSyncExternalStore } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  ANDROID_BETA,
  bannerDismissed,
  dismissBanner,
  isAndroid,
  takeDownloadInvite,
} from "~/lib/android-app";

// Nothing to subscribe to: the device and the dismissal only change on reload,
// apart from the visitor dismissing it here, which local state covers.
const subscribe = () => () => {};

/**
 * Whether to invite this visitor to test the app: Android, while the app is in
 * closed testing. False on the server, which can't know the device, so the
 * banner appears just after hydration.
 */
function useAndroidBeta({ dismissible }: { dismissible: boolean }) {
  return useSyncExternalStore(
    subscribe,
    () =>
      ANDROID_BETA &&
      isAndroid(navigator.userAgent) &&
      !(dismissible && bannerDismissed()),
    () => false,
  );
}

/** "Try the OurDIU Android app early", on the hub. */
export function AndroidBetaBanner() {
  const invited = useAndroidBeta({ dismissible: true });
  const [closed, setClosed] = useState(false);
  if (!invited || closed) return null;

  return (
    <aside
      aria-label="Android app"
      className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3 text-left sm:p-4"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Smartphone className="size-4.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="font-medium">Try the OurDIU Android app early</p>
          <p className="text-sm text-pretty text-muted-foreground">
            Help us get it on the Play Store. We need 12 testers.
          </p>
        </div>
        <Button size="sm" asChild>
          <Link to="/app">
            Become a tester
            <ArrowRight />
          </Link>
        </Button>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="-mt-1 -mr-1 size-8 text-muted-foreground"
        aria-label="Dismiss"
        onClick={() => {
          dismissBanner();
          setClosed(true);
        }}
      >
        <X />
      </Button>
    </aside>
  );
}

/**
 * Question Bank pages that get the slim strip under the header: its home and
 * where readers land from search and shared links. Contributing and your own
 * papers have their own invitations or none.
 */
function stripShownOn(pathname: string) {
  return (
    (pathname === "/questions" || pathname.startsWith("/questions/")) &&
    !pathname.startsWith("/questions/contribute") &&
    !pathname.startsWith("/questions/my-submissions")
  );
}

/** The banner's one-line form, under the header on Question Bank pages. */
export function AndroidBetaStrip() {
  const { pathname } = useLocation();
  const invited = useAndroidBeta({ dismissible: true });
  const [closed, setClosed] = useState(false);
  if (!invited || closed || !stripShownOn(pathname)) return null;

  return (
    <aside
      aria-label="Android app"
      className="border-b border-primary/20 bg-primary/5 text-sm"
    >
      <div className="container flex items-center gap-2 py-1.5">
        <Smartphone className="size-4 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 flex-1">
          OurDIU app for Android:{" "}
          <Link
            to="/app"
            className="font-medium text-primary underline underline-offset-4"
          >
            become a tester
          </Link>
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 size-7 text-muted-foreground"
          aria-label="Dismiss"
          onClick={() => {
            dismissBanner();
            setClosed(true);
          }}
        >
          <X />
        </Button>
      </div>
    </aside>
  );
}

/**
 * A one-line invitation for Android visitors, e.g. on the account page, where
 * it isn't dismissible.
 */
export function AndroidBetaLink({
  children = "The OurDIU Android app is in testing.",
}: {
  children?: React.ReactNode;
}) {
  if (!useAndroidBeta({ dismissible: false })) return null;

  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Smartphone className="size-4 shrink-0" aria-hidden />
      <span>
        {children}{" "}
        <Link
          to="/app"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Become a tester
        </Link>
      </span>
    </p>
  );
}

/**
 * A click handler for Download buttons: once per visit, an Android visitor who
 * hasn't dismissed the banner hears that the app reads papers offline.
 */
export function useDownloadInvite() {
  const invited = useAndroidBeta({ dismissible: true });
  const navigate = useNavigate();
  return useCallback(() => {
    if (!invited || !takeDownloadInvite()) return;
    toast("Read papers offline in the OurDIU app", {
      description: "It’s in testing on Android.",
      action: { label: "Become a tester", onClick: () => navigate("/app") },
      duration: 8000,
    });
  }, [invited, navigate]);
}
