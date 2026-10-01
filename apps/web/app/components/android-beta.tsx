import { ArrowRight, Smartphone, X } from "lucide-react";
import { useCallback, useState, useSyncExternalStore } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useRouteLoaderData,
} from "react-router";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  ANDROID_BETA,
  dismissBanner,
  inviteDismissed,
  takeDownloadInvite,
} from "~/lib/android-app";
import type { RootLoader } from "~/root";

// Nothing to subscribe to: closing the invitation here is covered by local
// state; other invitations read the cookie when they render.
const subscribe = () => () => {};

/**
 * Whether to invite this visitor to test the app: Android, while the app is in
 * closed testing. The server decides from the request (root loader), so the
 * invitation is in the HTML and nothing moves after hydration.
 */
function useAndroidBeta({ dismissible }: { dismissible: boolean }) {
  const invite = useRouteLoaderData<RootLoader>("root")?.androidInvite;
  const dismissed = useSyncExternalStore(
    subscribe,
    () => inviteDismissed(document.cookie),
    () => invite?.dismissed ?? false,
  );
  return Boolean(
    ANDROID_BETA && invite?.android && !(dismissible && dismissed),
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
      className="flex items-start gap-3 rounded-3xl bg-primary-container p-4 text-left text-primary-container-foreground sm:p-5"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <Smartphone className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="font-semibold">Try the OurDIU Android app early</p>
          <p className="text-sm text-pretty opacity-85">
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
        className="-mt-1 -mr-1 size-9 text-current hover:bg-current/10 hover:text-current"
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
      className="bg-primary-container text-sm text-primary-container-foreground"
    >
      <div className="container flex items-center gap-2 py-1.5">
        <Smartphone className="size-4 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1">
          OurDIU app for Android:{" "}
          <Link
            to="/app"
            className="font-semibold underline underline-offset-4"
          >
            become a tester
          </Link>
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 size-8 text-current hover:bg-current/10 hover:text-current"
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
