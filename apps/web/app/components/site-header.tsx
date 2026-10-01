import {
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
  Upload,
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
import { PRODUCTS, productAt, type Product } from "~/lib/products";
import { setTheme, useIsDark } from "~/lib/theme";
import type { SessionUser } from "~/lib/types";
import { cn } from "~/lib/utils";

type NavItem = {
  to: string;
  label: string;
  /** Other paths that count as this item's section, e.g. course pages for Browse. */
  section?: string[];
};

/** Each product's own menu; platform pages (hub, account, legal) have none. */
const NAV_ITEMS: Record<Product["id"], NavItem[]> = {
  questions: [
    {
      to: "/questions/departments",
      label: "Browse",
      section: ["/questions/browse", "/questions/courses/"],
    },
    { to: "/questions/contributors", label: "Contributors" },
  ],
  routine: [],
  market: [],
};

function inSection(item: NavItem, pathname: string) {
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
      className="flex min-w-0 items-center gap-2 font-semibold tracking-tight"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="truncate">{product?.name ?? "OurDIU"}</span>
    </Link>
  );
}

function UserMenu({
  user,
  product,
}: {
  user: SessionUser;
  product: Product | null;
}) {
  const submit = useSubmit();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Account menu"
        >
          <ContributorAvatar name={user.name} image={user.image} size="sm" />
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
        {product?.id === "questions" && (
          <DropdownMenuItem asChild>
            <Link to="/questions/my-submissions">
              <FileText aria-hidden />
              My submissions
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
          onSelect={() => submit(null, { method: "post", action: "/logout" })}
        >
          <LogOut aria-hidden />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const MENU_LINK =
  "flex min-h-11 items-center rounded-full px-3 text-[0.9375rem] font-medium transition-colors hover:bg-accent";

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
                : "hover:bg-accent",
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
}: {
  user: SessionUser | null;
  product: Product | null;
}) {
  const { pathname } = useLocation();
  const links: NavItem[] = [
    ...(product ? [{ to: product.href, label: "Home" }] : []),
    ...(product ? NAV_ITEMS[product.id] : []),
    ...(product?.id === "questions"
      ? [
          { to: "/questions/contribute", label: "Contribute a paper" },
          ...(user
            ? [{ to: "/questions/my-submissions", label: "My submissions" }]
            : []),
        ]
      : []),
    ...(user ? [{ to: "/account", label: "Account settings" }] : []),
    ...(user?.role === "admin" ? [{ to: "/admin", label: "Admin panel" }] : []),
  ];
  const others = PRODUCTS.filter((p) => p.id !== product?.id);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open menu"
        >
          <Menu aria-hidden />
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
                  to="/login"
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
                  item.to === product?.href
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
                          "bg-primary-container text-primary-container-foreground hover:bg-primary-container",
                      )}
                    >
                      {item.label}
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
            {product && (
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
export function SiteHeader({ user }: { user: SessionUser | null }) {
  const { pathname } = useLocation();
  const product = productAt(pathname);
  const items = product ? NAV_ITEMS[product.id] : [];
  const questions = product?.id === "questions";

  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
      <div className="container flex h-14 items-center gap-6 md:h-16">
        <div className="flex min-w-0 items-center gap-1">
          <ProductSwitcher current={product} />
          <Brand product={product} />
        </div>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {items.map((item) => {
            const active = inSection(item, pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center rounded-full px-3.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary-container font-semibold text-primary-container-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
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
              <CourseSearchTrigger className="hidden h-10 w-56 items-center gap-2.5 rounded-full bg-muted pr-2 pl-3.5 text-sm text-muted-foreground transition-colors hover:bg-accent md:flex lg:w-64">
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
                  "md:hidden",
                )}
              >
                <Search aria-hidden />
              </CourseSearchTrigger>
              <Link
                to="/questions/contribute"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "hidden h-10 rounded-full px-4 md:inline-flex",
                )}
              >
                <Upload aria-hidden />
                Contribute
              </Link>
              <CourseSearch />
            </>
          )}
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
          {user ? (
            <UserMenu user={user} product={product} />
          ) : (
            // An icon on phones, where the header is narrow.
            <Link
              to="/login"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "size-9 rounded-full p-0 md:h-10 md:w-auto md:px-3",
              )}
            >
              <LogIn className="md:hidden" aria-hidden />
              <span className="max-md:sr-only">Log in</span>
            </Link>
          )}
          <MobileMenu user={user} product={product} />
        </div>
      </div>
    </header>
  );
}
