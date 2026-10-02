import { useEffect, useSyncExternalStore } from "react";
import { useLocation, useRouteLoaderData } from "react-router";
import { afterLogoutPath } from "~/lib/redirect";
import {
  product,
  productAt,
  rememberedSpace,
  rememberSpace,
  spaceAt,
  type Product,
} from "~/lib/products";
import type { RootLoader } from "~/root";

// The cookie only changes in the effect below, after a navigation, and the next
// render reads it again.
const subscribe = () => () => {};

/**
 * The space this page shows in (see `spaceAt`): the server reads the remembered
 * space from the request, the browser from its cookie, which agree on the first
 * render.
 */
export function useSpace(): Product | null {
  const location = useLocation();
  const fromRequest = useRouteLoaderData<RootLoader>("root")?.space ?? null;
  const last = useSyncExternalStore(
    subscribe,
    () => rememberedSpace(document.cookie)?.id ?? null,
    () => fromRequest,
  );
  return spaceAt(location, last ? product(last) : null);
}

/** Remembers the space of every product page the visitor opens. */
export function useRememberSpace() {
  const { pathname } = useLocation();
  useEffect(() => {
    const current = productAt(pathname);
    if (current && rememberedSpace(document.cookie)?.id !== current.id) {
      rememberSpace(current);
    }
  }, [pathname]);
}

/** Where logging out from this page lands (see `afterLogoutPath`). */
export function useLogoutTarget(): string {
  const location = useLocation();
  return afterLogoutPath(location, useSpace()?.href);
}
