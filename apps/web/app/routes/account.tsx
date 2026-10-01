import { Outlet } from "react-router";
import { PageHeader } from "~/components/page-header";
import { Separator } from "~/components/ui/separator";
import { requireUser } from "~/lib/session.server";
import type { Route } from "./+types/account";

export async function loader({ request }: Route.LoaderArgs) {
  return { user: await requireUser(request) };
}

/**
 * The OurDIU account, shared by every product. A product's own pages for the
 * signed-in user live in its space (e.g. /questions/my-submissions).
 */
export default function AccountLayout({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* The site header's avatar already says who is signed in. */}
      <PageHeader title="Account" description={`Signed in as ${user.email}`} />
      <Separator />
      <Outlet />
    </div>
  );
}
