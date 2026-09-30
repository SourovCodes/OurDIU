import { USERNAME_PATTERN, USERNAME_RULES } from "@ourdiu/shared/constants";
import { Check } from "lucide-react";
import { data, Form, useNavigation } from "react-router";
import { FormField, FormMessage } from "~/components/form";
import { PageHeader } from "~/components/page-header";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { UserAvatar } from "~/components/user-avatar";
import { apiFetch, setCookieHeaders } from "~/lib/api.server";
import { requireUser } from "~/lib/session.server";
import type { Route } from "./+types/account";

export const meta: Route.MetaFunction = () => [
  { title: "Account — OurDIU" },
  { name: "robots", content: "noindex" },
];

export async function loader({ request }: Route.LoaderArgs) {
  return { user: await requireUser(request) };
}

type ActionResult = {
  success?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const MAX_NAME = 100;
const failed = (status: number) =>
  data<ActionResult>(
    { error: "Could not update your account. Please try again." },
    { status },
  );

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const username = String(form.get("username") ?? "")
    .trim()
    .toLowerCase();
  const fieldErrors: Record<string, string> = {};
  if (!name || name.length > MAX_NAME) {
    fieldErrors.name = `Enter a name of up to ${MAX_NAME} characters.`;
  }
  if (!USERNAME_PATTERN.test(username)) {
    fieldErrors.username = `Use ${USERNAME_RULES}.`;
  }
  if (Object.keys(fieldErrors).length > 0) {
    return data<ActionResult>({ fieldErrors }, { status: 422 });
  }

  const usernameRes = await apiFetch(request, "/api/v1/me/username", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username }),
  });
  if (usernameRes.status === 409) {
    return data<ActionResult>(
      { fieldErrors: { username: "Someone already has that username." } },
      { status: 422 },
    );
  }
  if (!usernameRes.ok) return failed(usernameRes.status);

  // The name is Better Auth's own field, so it goes through its update-user.
  const res = await apiFetch(request, "/api/auth/update-user", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) return failed(res.status);
  return data<ActionResult>(
    { success: "Saved" },
    { headers: setCookieHeaders(res) },
  );
}

export default function Account({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user } = loaderData;
  const submitting = useNavigation().state === "submitting";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Account"
        description="One account for every OurDIU product and the OurDIU app."
      />
      <Card className="gap-0 py-0">
        <div className="flex items-center gap-4 border-b p-6">
          <UserAvatar name={user.name} image={user.image} size="xl" />
          <div className="min-w-0">
            <p className="truncate font-medium">{user.name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>
        <Form method="post" aria-label="Account details">
          <div className="grid gap-4 p-6">
            <FormField
              label="Name"
              name="name"
              defaultValue={user.name}
              autoComplete="name"
              required
              maxLength={MAX_NAME}
              error={actionData?.fieldErrors?.name}
            />
            <div className="grid gap-1.5">
              <FormField
                // Re-mounted once saved, to show it as stored (lowercase).
                key={user.username}
                label="Username"
                name="username"
                defaultValue={user.username ?? ""}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                minLength={3}
                maxLength={50}
                error={actionData?.fieldErrors?.username}
              />
              <p className="text-xs text-muted-foreground">{USERNAME_RULES}.</p>
            </div>
            <FormMessage message={actionData?.error} />
          </div>
          <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
            {actionData?.success && !submitting && (
              <p
                role="status"
                className="flex items-center gap-1.5 text-sm text-muted-foreground"
              >
                <Check className="size-4" aria-hidden />
                {actionData.success}
              </p>
            )}
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
}
