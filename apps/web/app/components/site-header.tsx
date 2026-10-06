import {
  Bookmark,
  GraduationCap,
  LogIn,
  Menu,
  Search,
  Plus,
} from "lucide-react";
import { Link, useLocation } from "react-router";
import { ContributorAvatar } from "~/components/contributor-avatar";
import { CourseSearch, CourseSearchTrigger } from "~/components/course-search";
import { onFirstUse } from "~/components/on-first-use";
import { ProductSwitcher } from "~/components/product-switcher";
import { attentionLabel, inSection, useNavItems } from "~/components/site-nav";
import { ThemeToggle } from "~/components/theme-toggle";
import { Button, buttonVariants } from "~/components/ui/button";
import type { Product } from "~/lib/products";
import { useSpace } from "~/lib/use-space";
import { loginHref } from "~/lib/redirect";
import type { SessionUser } from "~/lib/types";
import { cn } from "~/lib/utils";

// The menus' code loads on first use (components/on-first-use.tsx).
const LazyUserMenu = onFirstUse(() => import("~/components/user-menu"), "menu");
const LazyMobileMenu = onFirstUse(
  () => import("~/components/mobile-menu"),
  "dialog",
);

/** The current space's name and home: OurDIU itself, or a product. */
function Brand({ product }: { product: Product | null }) {
  const Icon = product?.icon ?? GraduationCap;
  return (
    <Link
      to={product?.href ?? "/"}
      className="flex min-w-0 shrink-0 items-center gap-2.5 text-primary transition-opacity hover:opacity-80"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="font-expressive text-lg tracking-tight whitespace-nowrap sm:text-xl">
        {product?.name ?? "OurDIU"}
      </span>
    </Link>
  );
}

/**
 * The header of the space the page is in: the switcher, the space's name, and its
 * own menu. Products don't link to each other; the switcher is the way between them.
 */
export function SiteHeader({
  user,
  needsAttention = 0,
}: {
  user: SessionUser | null;
  /** The user's papers that need them (changes asked for, unread messages). */
  needsAttention?: number;
}) {
  const location = useLocation();
  const { pathname } = location;
  const product = useSpace();
  const items = useNavItems(product);
  const questions = product?.id === "questions";

  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <div className="container flex h-16 items-center gap-6">
        <div className="flex min-w-0 items-center gap-1">
          {/* On phones the menu has the other spaces. */}
          <div className="max-sm:hidden">
            <ProductSwitcher current={product} />
          </div>
          <Brand product={product} />
        </div>
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {items.map((item) => {
            const active = inSection(item, pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center rounded-full px-4 text-[0.9375rem] font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-primary-container font-semibold text-primary-container-foreground"
                    : "hover:state-layer",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {questions && (
            <>
              <CourseSearchTrigger className="hidden h-10 w-60 items-center gap-2.5 rounded-full bg-surface pr-2 pl-4 text-sm text-muted-foreground transition-colors hover:state-layer xl:flex">
                <Search className="size-4" aria-hidden />
                <span className="flex-1">Search courses</span>
                <kbd className="rounded-md border border-input px-1.5 py-0.5 font-sans text-xs">
                  /
                </kbd>
              </CourseSearchTrigger>
              <CourseSearchTrigger
                aria-label="Search courses"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "xl:hidden",
                )}
              >
                <Search aria-hidden />
              </CourseSearchTrigger>
              <CourseSearch />
              <Link
                to="/questions/saved"
                aria-label="Saved papers"
                title="Saved papers"
                aria-current={
                  pathname === "/questions/saved" ? "page" : undefined
                }
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "aria-[current=page]:bg-primary-container aria-[current=page]:text-primary-container-foreground max-sm:hidden",
                )}
              >
                <Bookmark aria-hidden />
              </Link>
            </>
          )}
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
          {questions && (
            <Link
              to="/questions/contribute"
              aria-current={
                pathname.startsWith("/questions/contribute")
                  ? "page"
                  : undefined
              }
              // On the page itself it's a tonal "you are here", not a call to action.
              className={cn(
                buttonVariants({
                  variant: pathname.startsWith("/questions/contribute")
                    ? "secondary"
                    : "default",
                }),
                "hidden sm:inline-flex",
              )}
            >
              <Plus aria-hidden />
              Share a paper
            </Link>
          )}
          {user ? (
            <LazyUserMenu
              user={user}
              product={product}
              needsAttention={needsAttention}
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative rounded-full"
                  aria-label={
                    needsAttention > 0
                      ? `Account menu, ${attentionLabel(needsAttention)}`
                      : "Account menu"
                  }
                >
                  <ContributorAvatar
                    name={user.name}
                    image={user.image}
                    size="sm"
                  />
                  {needsAttention > 0 && (
                    <span
                      aria-hidden
                      className="absolute top-0.5 right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-background"
                    />
                  )}
                </Button>
              }
            />
          ) : (
            // An icon on phones, where the header is narrow.
            <Link
              to={loginHref(location)}
              aria-current={pathname === "/login" ? "page" : undefined}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "max-sm:size-10 max-sm:border-0 max-sm:p-0 max-sm:text-foreground",
              )}
            >
              <LogIn className="sm:hidden" aria-hidden />
              <span className="max-sm:sr-only">Log in</span>
            </Link>
          )}
          <LazyMobileMenu
            user={user}
            product={product}
            needsAttention={needsAttention}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="relative lg:hidden"
                aria-label="Open menu"
              >
                <Menu aria-hidden />
                {needsAttention > 0 && product?.id === "questions" && (
                  <span
                    aria-hidden
                    className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-primary ring-2 ring-background"
                  />
                )}
              </Button>
            }
          />
        </div>
      </div>
    </header>
  );
}
