import { lazy, Suspense, useSyncExternalStore } from "react";
import { useLocation } from "react-router";
import { appPathFor, offersAppSheet } from "~/lib/android-app";

const OpenInAppSheet = lazy(() => import("./open-in-app-sheet"));

// Nothing to subscribe to: the sheet sets its cookie as it closes, and the next
// render reads it.
const subscribe = () => () => {};

/**
 * Asks Android visitors, once, to use the app (docs/PLAN.md, decision 55). Decided
 * in the browser after hydration, so pages stay the same for everyone (and for
 * any cache in front of them); the sheet floats over the page, so nothing moves
 * when it appears, and its code loads only for the visitors who get it.
 */
export function AppSheet() {
  const { pathname, search } = useLocation();
  const offered = useSyncExternalStore(
    subscribe,
    () => offersAppSheet(navigator.userAgent, document.cookie, pathname),
    () => false,
  );
  if (!offered) return null;
  return (
    <Suspense fallback={null}>
      <OpenInAppSheet path={appPathFor(pathname, search)} />
    </Suspense>
  );
}
