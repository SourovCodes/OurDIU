import { FileText, LogOut, Settings, ShieldCheck } from "lucide-react";
import { Link, useSubmit } from "react-router";
import { ContributorAvatar } from "~/components/contributor-avatar";
import type { FirstUseProps } from "~/components/on-first-use";
import { attentionLabel, CountPill } from "~/components/site-nav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type { Product } from "~/lib/products";
import { useLogoutTarget } from "~/lib/use-space";
import type { SessionUser } from "~/lib/types";

/** The signed-in visitor's menu, loaded on first use (`LazyUserMenu`). */
export default function UserMenu({
  user,
  product,
  needsAttention,
  trigger,
  defaultOpen,
}: {
  user: SessionUser;
  product: Product | null;
  needsAttention: number;
} & FirstUseProps) {
  const submit = useSubmit();
  const logoutTarget = useLogoutTarget();

  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
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
