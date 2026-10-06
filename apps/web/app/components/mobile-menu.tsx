import { LogOut, Moon, Sun } from "lucide-react";
import { Form, Link, useLocation } from "react-router";
import { ContributorAvatar } from "~/components/contributor-avatar";
import type { FirstUseProps } from "~/components/on-first-use";
import {
  attentionLabel,
  CountPill,
  inSection,
  useNavItems,
  type NavItem,
} from "~/components/site-nav";
import { Button, buttonVariants } from "~/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { HUB_LIVE, type Product } from "~/lib/products";
import { loginHref } from "~/lib/redirect";
import { setTheme, useIsDark } from "~/lib/theme";
import type { SessionUser } from "~/lib/types";
import { useProducts } from "~/lib/use-products";
import { useLogoutTarget } from "~/lib/use-space";
import { cn } from "~/lib/utils";

const MENU_LINK =
  "flex min-h-11 items-center rounded-full px-3 text-[0.9375rem] font-medium transition-colors hover:state-layer";

/** Light or dark, as two segments; the header's toggle is hidden on phones. */
function ThemeSegments() {
  const dark = useIsDark();
  return (
    <div
      role="group"
      aria-label="Theme"
      className="grid grid-cols-2 overflow-hidden rounded-full border"
    >
      {(["light", "dark"] as const).map((theme) => {
        const on = dark === (theme === "dark");
        const Icon = theme === "dark" ? Moon : Sun;
        return (
          <button
            key={theme}
            type="button"
            aria-pressed={on}
            onClick={() => setTheme(theme)}
            className={cn(
              "flex h-10 items-center justify-center gap-2 text-sm font-semibold transition-colors",
              on
                ? "bg-primary-container text-primary-container-foreground"
                : "hover:state-layer",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {theme === "dark" ? "Dark" : "Light"}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Below `md` everything lives in a slide-over menu: logging in, the space's pages,
 * the visitor's own pages, the other spaces and the theme.
 */
export default function MobileMenu({
  user,
  product,
  needsAttention,
  trigger,
  defaultOpen,
}: {
  user: SessionUser | null;
  product: Product | null;
  needsAttention: number;
} & FirstUseProps) {
  const location = useLocation();
  const logoutTarget = useLogoutTarget();
  const { pathname } = location;
  const items = useNavItems(product);
  const links: NavItem[] = [
    // The routine's Today is its home.
    ...(product && product.id !== "routine"
      ? [{ to: product.href, label: "Home" }]
      : []),
    ...items,
    ...(product?.id === "questions"
      ? [
          { to: "/questions/saved", label: "Saved" },
          { to: "/questions/contribute", label: "Share a paper" },
          ...(user
            ? [
                {
                  to: "/questions/my-submissions",
                  label: "My submissions",
                  count: needsAttention,
                },
              ]
            : []),
        ]
      : []),
    ...(user ? [{ to: "/account", label: "Account settings" }] : []),
    ...(user?.role === "admin" ? [{ to: "/admin", label: "Admin panel" }] : []),
  ];
  const others = useProducts().filter((p) => p.id !== product?.id);

  return (
    <Sheet defaultOpen={defaultOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="right"
        className="w-80 gap-0 overflow-y-auto rounded-l-3xl"
      >
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Site navigation
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-5 px-3 pb-4">
          {user ? (
            <div className="flex items-center gap-3 rounded-2xl bg-muted p-3">
              <ContributorAvatar name={user.name} image={user.image} />
              <div className="grid min-w-0 leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 rounded-2xl bg-muted p-4">
              <p className="text-sm">
                Log in to share papers, vote and follow your submissions.
              </p>
              <SheetClose asChild>
                <Link
                  to={loginHref(location)}
                  className={cn(buttonVariants(), "h-11 rounded-full")}
                >
                  Log in with Google
                </Link>
              </SheetClose>
            </div>
          )}

          {links.length > 0 && (
            <nav aria-label="Mobile" className="grid gap-0.5">
              {product && (
                <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {product.name}
                </p>
              )}
              {links.map((item) => {
                const active =
                  item.to === product?.href && item.active === undefined
                    ? pathname === item.to
                    : inSection(item, pathname);
                return (
                  <SheetClose key={item.to} asChild>
                    <Link
                      to={item.to}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        MENU_LINK,
                        active &&
                          "bg-primary-container text-primary-container-foreground",
                      )}
                    >
                      {item.label}
                      {!!item.count && (
                        <>
                          <CountPill count={item.count} />
                          <span className="sr-only">
                            , {attentionLabel(item.count)}
                          </span>
                        </>
                      )}
                    </Link>
                  </SheetClose>
                );
              })}
            </nav>
          )}

          <nav aria-label="OurDIU" className="grid gap-0.5">
            <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              OurDIU
            </p>
            {others.map((p) => (
              <SheetClose key={p.id} asChild>
                <Link to={p.href} className={cn(MENU_LINK, "justify-between")}>
                  {p.name}
                  {p.status === "soon" && (
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                      Soon
                    </span>
                  )}
                </Link>
              </SheetClose>
            ))}
            {product && HUB_LIVE && (
              <SheetClose asChild>
                <Link to="/" className={MENU_LINK}>
                  All of OurDIU
                </Link>
              </SheetClose>
            )}
          </nav>

          <div className="mt-auto grid gap-3">
            <ThemeSegments />
            {user && (
              <Form method="post" action="/logout">
                <input type="hidden" name="redirectTo" value={logoutTarget} />
                <Button
                  type="submit"
                  variant="ghost"
                  className="h-11 w-full rounded-full"
                >
                  <LogOut aria-hidden />
                  Log out
                </Button>
              </Form>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
