import { Check, House, LayoutGrid } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { HUB_LIVE, PRODUCTS, type Product } from "~/lib/products";

/** The way between OurDIU's products: the hub, and each product's space. */
export function ProductSwitcher({ current }: { current: Product | null }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label="Switch product"
        >
          <LayoutGrid aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 rounded-lg">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          OurDIU
        </DropdownMenuLabel>
        {PRODUCTS.map((product) => {
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
