import { Check, House } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import type { FirstUseProps } from "~/components/on-first-use";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { HUB_LIVE, type Product } from "~/lib/products";
import { useProducts } from "~/lib/use-products";

/** The switcher's menu, loaded on first use (`ProductSwitcher`). */
export default function ProductSwitcherMenu({
  current,
  trigger,
  defaultOpen,
}: { current: Product | null } & FirstUseProps) {
  const products = useProducts();
  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 rounded-lg">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          OurDIU
        </DropdownMenuLabel>
        {products.map((product) => {
          const { id, icon: Icon, name, tagline, href, status } = product;
          const isCurrent = current?.id === id;
          return (
            <DropdownMenuItem key={id} asChild>
              <Link
                to={href}
                aria-current={isCurrent ? "page" : undefined}
                className="gap-3 py-2"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon aria-hidden />
                </span>
                <span className="grid flex-1 leading-tight">
                  <span className="font-medium">{name}</span>
                  <span className="text-xs text-muted-foreground">
                    {tagline}
                  </span>
                </span>
                {isCurrent ? (
                  <Check aria-label="Current" />
                ) : (
                  status === "soon" && <Badge variant="secondary">Soon</Badge>
                )}
              </Link>
            </DropdownMenuItem>
          );
        })}
        {HUB_LIVE && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/">
                <House aria-hidden />
                All of OurDIU
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
