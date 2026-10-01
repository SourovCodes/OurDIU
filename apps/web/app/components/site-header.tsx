import {
  FileText,
  GraduationCap,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Link, NavLink, useLocation, useSubmit } from "react-router";
import { ContributorAvatar } from "~/components/contributor-avatar";
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
import { productAt, type Product } from "~/lib/products";
import type { SessionUser } from "~/lib/types";
import { cn } from "~/lib/utils";

type NavItem = { to: string; label: string };

/** Each product's own menu; platform pages (hub, account, legal) have none. */
const NAV_ITEMS: Record<Product["id"], NavItem[]> = {
  questions: [
    { to: "/questions/browse", label: "Browse" },
    { to: "/questions/contributors", label: "Contributors" },
  ],
  routine: [],
  market: [],
};

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

/** Below `md` the page links live in a slide-over menu. */
function MobileMenu({
  user,
  product,
}: {
  user: SessionUser | null;
  product: Product | null;
}) {
  const links = [
    ...(product ? NAV_ITEMS[product.id] : []),
    ...(product?.id === "questions"
      ? [{ to: "/questions/contribute", label: "Contribute" }]
      : []),
    ...(user?.role === "admin" ? [{ to: "/admin", label: "Admin panel" }] : []),
  ];

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
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Site navigation
          </SheetDescription>
        </SheetHeader>
        <nav aria-label="Mobile" className="grid gap-1 px-4">
          {links.map(({ to, label }) => (
            <SheetClose key={to} asChild>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-foreground",
                    isActive
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground",
                  )
                }
              >
                {label}
              </NavLink>
            </SheetClose>
          ))}
        </nav>
        {!user && (
          <div className="mt-auto grid border-t p-4">
            <SheetClose asChild>
              <Link to="/login" className={buttonVariants()}>
                Log in
              </Link>
            </SheetClose>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * The header of the space the page is in: the switcher, the space's name, and its
 * own menu. Products don't link to each other; the switcher is the way between them.
 */
export function SiteHeader({ user }: { user: SessionUser | null }) {
  const product = productAt(useLocation().pathname);
  const items = product ? NAV_ITEMS[product.id] : [];

  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
      <div className="container flex h-14 items-center gap-6">
        <div className="flex min-w-0 items-center gap-1">
          <ProductSwitcher current={product} />
          <Brand product={product} />
        </div>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {items.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "px-3 py-1.5 text-sm font-medium transition-colors hover:text-foreground",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {product?.id === "questions" && (
            <Link
              to="/questions/contribute"
              className={cn(
                buttonVariants({ size: "sm" }),
                "hidden sm:inline-flex",
              )}
            >
              <Upload aria-hidden />
              Contribute
            </Link>
          )}
          <ThemeToggle />
          {user ? (
            <UserMenu user={user} product={product} />
          ) : (
            <Link
              to="/login"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Log in
            </Link>
          )}
          <MobileMenu user={user} product={product} />
        </div>
      </div>
    </header>
  );
}
