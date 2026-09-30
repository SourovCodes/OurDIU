import {
  GraduationCap,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { Link, NavLink, useSubmit } from "react-router";
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
import { UserAvatar } from "~/components/user-avatar";
import type { SessionUser } from "~/lib/types";
import { cn } from "~/lib/utils";

/** The products that live on this site; the question bank is linked from the hub. */
const NAV_ITEMS = [
  { to: "/routine", label: "Routine" },
  { to: "/market", label: "Marketplace" },
];

export function Brand() {
  return (
    <Link
      to="/"
      className="flex shrink-0 items-center gap-2 font-semibold tracking-tight"
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <GraduationCap className="size-4" aria-hidden />
      </span>
      OurDIU
    </Link>
  );
}

function UserMenu({ user }: { user: SessionUser }) {
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
          <UserAvatar name={user.name} image={user.image} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-lg">
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <UserAvatar
              name={user.name}
              image={user.image}
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
          <DropdownMenuItem asChild>
            <Link to="/admin">
              <ShieldCheck aria-hidden />
              Admin panel
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
function MobileMenu({ user }: { user: SessionUser | null }) {
  const links = [
    ...NAV_ITEMS,
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

export function SiteHeader({ user }: { user: SessionUser | null }) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
      <div className="container flex h-14 items-center gap-6">
        <Brand />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map(({ to, label }) => (
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
          <ThemeToggle />
          {user ? (
            <UserMenu user={user} />
          ) : (
            <Link
              to="/login"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Log in
            </Link>
          )}
          <MobileMenu user={user} />
        </div>
      </div>
    </header>
  );
}
