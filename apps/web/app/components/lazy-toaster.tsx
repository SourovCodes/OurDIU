import { lazy, Suspense, useEffect, useState } from "react";
import { whenIdle } from "~/lib/idle";
import { TOASTER_WANTED } from "~/lib/toast";

const Toaster = lazy(() =>
  import("~/components/ui/sonner").then((m) => ({ default: m.Toaster })),
);

/**
 * The Toaster, mounted once the browser is idle or when a toast is shown first
 * (lib/toast.ts), so sonner isn't part of every page's first load.
 */
export function LazyToaster(props: React.ComponentProps<typeof Toaster>) {
  const [wanted, setWanted] = useState(false);
  useEffect(() => {
    const want = () => setWanted(true);
    window.addEventListener(TOASTER_WANTED, want);
    const cancel = whenIdle(want);
    return () => {
      window.removeEventListener(TOASTER_WANTED, want);
      cancel();
    };
  }, []);
  return wanted ? (
    <Suspense>
      <Toaster {...props} />
    </Suspense>
  ) : null;
}
