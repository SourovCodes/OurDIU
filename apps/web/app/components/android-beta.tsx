import { Smartphone, X } from "lucide-react";
import { useCallback, useState, useSyncExternalStore } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useRouteLoaderData,
} from "react-router";
import { toast } from "~/lib/toast";
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
 * Whether the visitor closed the invitation. The server reads the cookie
 * (root loader), so the invitation is in the HTML and nothing moves after
 * hydration.
 */
function useInviteDismissed() {
  const invite = useRouteLoaderData<RootLoader>("root")?.androidInvite;
  return useSyncExternalStore(
    subscribe,
    () => inviteDismissed(document.cookie),
    () => invite?.dismissed ?? false,
  );
}

/** Whether this visitor browses on Android, as the server saw it. */
function useOnAndroid() {
  return Boolean(
    useRouteLoaderData<RootLoader>("root")?.androidInvite?.android,
  );
}

/** Pages without the strip: the page it leads to. */
function stripShownOn(pathname: string) {
  return pathname !== "/app";
}

/**
 * The invitation to test the app, under the header on every page and for
 * every visitor (a computer's owner likely has an Android phone too) while
 * the app is in closed testing. Once closed it stays closed; the footer's
 * "Get the app" and the account page still lead to /app.
 */
export function AndroidBetaStrip() {
  const { pathname } = useLocation();
  const dismissed = useInviteDismissed();
  const [closed, setClosed] = useState(false);
  if (!ANDROID_BETA || dismissed || closed || !stripShownOn(pathname)) {
    return null;
  }

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
            className="font-semibold underline decoration-1 underline-offset-4 hover:decoration-2"
          >
            become a tester
          </Link>
          <span className="hidden opacity-85 sm:inline">
            {" "}
            and help us get it on the Play Store
          </span>
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
 * A one-line invitation, e.g. on the account page. It can't be closed, so a
 * visitor who closed the strip can still find the app.
 */
export function AndroidBetaLink({
  children = "The OurDIU Android app is in testing.",
}: {
  children?: React.ReactNode;
}) {
  if (!ANDROID_BETA) return null;

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
 * hasn't closed the strip hears that the app reads papers offline.
 */
export function useDownloadInvite() {
  const android = useOnAndroid();
  const dismissed = useInviteDismissed();
  const invited = ANDROID_BETA && android && !dismissed;
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
