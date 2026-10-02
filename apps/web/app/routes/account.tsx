import { canContribute } from "@ourdiu/shared/constants";
import {
  Bookmark,
  ChevronRight,
  FileText,
  LogOut,
  Moon,
  Plus,
  Sun,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Form, Link, Outlet } from "react-router";
import { AndroidBetaLink } from "~/components/android-beta";
import { ContributorAvatar } from "~/components/contributor-avatar";
import { Button } from "~/components/ui/button";
import { requireUser } from "~/lib/session.server";
import { contributorUrl } from "~/lib/submissions";
import { useLogoutTarget } from "~/lib/use-space";
import { setTheme, useIsDark } from "~/lib/theme";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/account";
import { NARROW_PAGE } from "~/components/page-header";

export const meta: Route.MetaFunction = () => [
  { title: "Account — OurDIU" },
  { name: "robots", content: "noindex" },
];

export async function loader({ request }: Route.LoaderArgs) {
  return { user: await requireUser(request) };
}

function QuickLink({
  to,
  icon: Icon,
  title,
  text,
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 rounded-3xl bg-surface p-4 transition-[background-color,scale] hover:bg-surface-high active:scale-[0.99]"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-primary-container-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block truncate text-sm text-muted-foreground">
          {text}
        </span>
      </span>
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    </Link>
  );
}

/** Light or dark, as the app's Appearance setting. */
function Appearance() {
  const dark = useIsDark();
  return (
    <section
      aria-labelledby="appearance-heading"
      className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-surface p-5"
    >
      <div>
        <h2 id="appearance-heading" className="font-semibold">
          Appearance
        </h2>
        <p className="text-sm text-muted-foreground">
          Until you pick one, the site follows your device.
        </p>
      </div>
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
                "flex h-10 items-center justify-center gap-2 px-5 text-sm font-semibold transition-colors",
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
    </section>
  );
}

/**
 * The OurDIU account, shared by every product, laid out like the app's Account
 * tab: who you are, your things, settings, then logging out.
 */
export default function AccountLayout({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const contributes = canContribute({ email: user.email, role: user.role });
  const logoutTarget = useLogoutTarget();

  return (
    <div className={cn(NARROW_PAGE, "space-y-6")}>
      <h1 className="font-display-xl text-5xl sm:text-7xl">Account</h1>

      <section className="flex items-center gap-5 rounded-[2rem] bg-primary-container p-6 text-primary-container-foreground sm:p-8">
        <ContributorAvatar
          name={user.name}
          image={user.image}
          size="xl"
          className="max-sm:size-16"
        />
        <div className="min-w-0">
          <p className="truncate font-expressive text-2xl sm:text-3xl">
            {user.name}
          </p>
          <p className="truncate opacity-85">{user.email}</p>
        </div>
      </section>

      <nav aria-label="Your things" className="grid gap-2 sm:grid-cols-2">
        <QuickLink
          to="/questions/my-submissions"
          icon={FileText}
          title="My submissions"
          text="Papers you shared and their review"
        />
        <QuickLink
          to="/questions/saved"
          icon={Bookmark}
          title="Saved papers"
          text="Also in the OurDIU app"
        />
        {user.username && (
          <QuickLink
            to={contributorUrl(user.username)}
            icon={UserRound}
            title="Public profile"
            text="What other students see"
          />
        )}
        {contributes && (
          <QuickLink
            to="/questions/contribute"
            icon={Plus}
            title="Share a paper"
            text="Just sat an exam? Takes a minute"
          />
        )}
      </nav>

      <AndroidBetaLink />
      <Outlet />
      <Appearance />

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Form method="post" action="/logout">
          <input type="hidden" name="redirectTo" value={logoutTarget} />
          <Button type="submit" variant="outline">
            <LogOut aria-hidden />
            Log out
          </Button>
        </Form>
        <Link
          to="/delete-account"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
        >
          Delete my account
        </Link>
      </div>
    </div>
  );
}
