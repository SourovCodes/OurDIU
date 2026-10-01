import { ArrowRight, Smartphone, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import {
  ANDROID_BETA,
  bannerDismissed,
  dismissBanner,
  isAndroid,
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

/** "Try the OurDIU Android app early", on the hub and the Question Bank home. */
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

/** A one-line invitation for signed-in Android visitors, on the account page. */
export function AndroidBetaLink() {
  if (!useAndroidBeta({ dismissible: false })) return null;

  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Smartphone className="size-4 shrink-0" aria-hidden />
      <span>
        The OurDIU Android app is in testing.{" "}
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
