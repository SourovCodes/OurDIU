import { LayoutGrid } from "lucide-react";
import { onFirstUse } from "~/components/on-first-use";
import { Button } from "~/components/ui/button";
import type { Product } from "~/lib/products";

// The menu's code loads on first use (components/on-first-use.tsx).
const LazyMenu = onFirstUse(
  () => import("~/components/product-switcher-menu"),
  "menu",
);

/** The way between OurDIU's products: the hub, and each product's space. */
export function ProductSwitcher({ current }: { current: Product | null }) {
  return (
    <LazyMenu
      current={current}
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label="Switch product"
        >
          <LayoutGrid aria-hidden />
        </Button>
      }
    />
  );
}
