import {
  Bookmark,
  FileText,
  GraduationCap,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Plus,
} from "lucide-react";
import { Form, Link, useLocation, useSubmit } from "react-router";
import { ContributorAvatar } from "~/components/contributor-avatar";
import { CourseSearch, CourseSearchTrigger } from "~/components/course-search";
import { ProductSwitcher } from "~/components/product-switcher";
import { ThemeToggle } from "~/components/theme-toggle";
import { Button, buttonVariants } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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
import { useProducts } from "~/lib/use-products";
import { useLogoutTarget, useSpace } from "~/lib/use-space";
import { loginHref } from "~/lib/redirect";
import { setTheme, useIsDark } from "~/lib/theme";
import type { SessionUser } from "~/lib/types";
import { cn } from "~/lib/utils";
import { useRoutinePlaces } from "./routine-nav";

type NavItem = {
  to: string;
  label: string;
  /** Other paths that count as this item's section, e.g. course pages for Browse. */
  section?: string[];
  /** A count to show next to it, e.g. papers that need the user. */
  count?: number;
  /** Whether the page is in its section, when the path alone can't tell. */
  active?: boolean;
};

/** Each product's own menu; platform pages (hub, account, legal) have none. */
const NAV_ITEMS: Record<Product["id"], NavItem[]> = {
  questions: [
    {
      to: "/questions/departments",
      label: "Browse",
      section: ["/questions/courses/"],
    },
    { to: "/questions/browse", label: "All papers" },
    { to: "/questions/contributors", label: "Contributors" },
  ],
  // Today, Sections and Teachers depend on the department: `useNavItems`.
  routine: [],
  market: [],
};

/** The space's menu: the Class Routine's places follow the department. */
function useNavItems(product: Product | null): NavItem[] {
  const places = useRoutinePlaces();
  if (!product) return [];
  return product.id === "routine" ? [...places] : NAV_ITEMS[product.id];
}

function inSection(item: NavItem, pathname: string) {
  if (item.active !== undefined) return item.active;
  return (
    pathname === item.to ||
    pathname.startsWith(`${item.to}/`) ||
    (item.section ?? []).some((prefix) => pathname.startsWith(prefix))
  );
}

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

/** "3", as a small pill next to a menu entry. */
function CountPill({ count }: { count: number }) {
  return (
    <span className="ml-auto rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
      {count}
    </span>
  );
}

const attentionLabel = (count: number) =>
  `${count} ${count === 1 ? "paper needs" : "papers need"} you`;

function UserMenu({
  user,
  product,
  needsAttention,
}: {
  user: SessionUser;
  product: Product | null;
  needsAttention: number;
}) {
  const submit = useSubmit();
  const logoutTarget = useLogoutTarget();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
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
          <ContributorAvatar name={user.name} image={user.image} size="sm" />
          {needsAttention > 0 && (
            <span
              aria-hidden
              className="absolute top-0.5 right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-background"
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-lg">
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <ContributorAvatar
              name={user.name}
              image={user.image}
              size="sm"
              className="rounded-lg"
            />
            <div className="grid flex-1 leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.role === "admin" && (
          <>
            <DropdownMenuItem asChild>
              <Link to="/admin">
                <ShieldCheck aria-hidden />
                Admin panel
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {(product?.id === "questions" || needsAttention > 0) && (
          <DropdownMenuItem asChild>
            <Link to="/questions/my-submissions">
              <FileText aria-hidden />
              My submissions
              {needsAttention > 0 && (
                <>
                  <CountPill count={needsAttention} />
                  <span className="sr-only">
                    , {attentionLabel(needsAttention)}
                  </span>
                </>
              )}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link to="/account">
            <Settings aria-hidden />
            Account settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            submit(
              { redirectTo: logoutTarget },
              { method: "post", action: "/logout" },
            )
          }
        >
          <LogOut aria-hidden />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
function MobileMenu({
  user,
  product,
  needsAttention,
}: {
  user: SessionUser | null;
  product: Product | null;
  needsAttention: number;
}) {
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
    <Sheet>
      <SheetTrigger asChild>
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
      </SheetTrigger>
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
            <UserMenu
              user={user}
              product={product}
              needsAttention={needsAttention}
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
          <MobileMenu
            user={user}
            product={product}
            needsAttention={needsAttention}
          />
        </div>
      </div>
    </header>
  );
}
