import { useRouteLoaderData } from "react-router";
import { productsWith } from "~/lib/products";
import type { RootLoader } from "~/root";

/**
 * The products as the switchers show them: the Class Routine "soon" until a
 * department's routine is live (the root loader asks), so publishing one needs
 * no deploy.
 */
export function useProducts() {
  const root = useRouteLoaderData<RootLoader>("root");
  return productsWith(root?.routineLive ?? false);
}
