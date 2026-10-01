import { USERNAME_PATTERN, USERNAME_RULES } from "@ourdiu/shared/constants";
import type { ApiError } from "@ourdiu/shared";
import { Check } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { data, Form, useNavigation } from "react-router";
import { AvatarInput } from "~/components/avatar-input";
import { ContributorAvatar } from "~/components/contributor-avatar";
import { FormField, FormMessage } from "~/components/form";
import { Button } from "~/components/ui/button";
import { apiFetch, readJson, setCookieHeaders } from "~/lib/api.server";
import { requireUser } from "~/lib/session.server";
import type { Route } from "./+types/account-profile";

export const meta: Route.MetaFunction = () => [
  { title: "Profile — OurDIU" },
  { name: "robots", content: "noindex" },
];

export async function loader({ request }: Route.LoaderArgs) {
  return { user: await requireUser(request) };
}

type Intent = "profile" | "avatar";

type ActionResult = {
  intent: Intent;
  success?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const MAX_NAME = 100;

const invalid = (intent: Intent, fieldErrors: Record<string, string>) =>
  data<ActionResult>({ intent, fieldErrors }, { status: 422 });

async function updateProfile(request: Request, form: FormData) {
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
    return invalid("profile", fieldErrors);
  }

  const usernameRes = await apiFetch(request, "/api/v1/me/username", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username }),
  });
  if (usernameRes.status === 409) {
    return invalid("profile", {
      username: "Someone already has that username.",
    });
  }
  if (!usernameRes.ok) {
    return data<ActionResult>(
      {
        intent: "profile",
        error: "Could not update your profile. Please try again.",
      },
      { status: usernameRes.status },
    );
  }

  const res = await apiFetch(request, "/api/auth/update-user", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    return data<ActionResult>(
      {
        intent: "profile",
        error: "Could not update your profile. Please try again.",
      },
      { status: res.status },
    );
  }
  return data<ActionResult>(
    { intent: "profile", success: "Profile updated" },
    { headers: setCookieHeaders(res) },
  );
}

async function avatarResult(res: Response, success: string) {
  if (res.ok) return data<ActionResult>({ intent: "avatar", success });
  const body = await readJson<ApiError>(res).catch(() => null);
  return data<ActionResult>(
    {
      intent: "avatar",
      error:
        body && body.error.code !== "VALIDATION_ERROR"
          ? body.error.message
          : "Choose an image to upload.",
    },
    { status: res.status },
  );
}

async function uploadAvatar(request: Request, form: FormData) {
  const file = form.get("file");
  const body = new FormData();
  if (file instanceof File && file.size > 0) body.append("file", file);
  const res = await apiFetch(request, "/api/v1/me/avatar", {
    method: "PUT",
    body,
  });
  return avatarResult(res, "Photo updated");
}

async function removeAvatar(request: Request) {
  const res = await apiFetch(request, "/api/v1/me/avatar", {
    method: "DELETE",
  });
  return avatarResult(res, "Photo removed");
}

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const form = await request.formData();
  switch (form.get("intent")) {
    case "avatar":
      return uploadAvatar(request, form);
    case "removeAvatar":
      return removeAvatar(request);
    case "profile":
      return updateProfile(request, form);
    default:
      throw data("Unknown action", { status: 400 });
  }
}

/** A settings row: what it is on the left (from `md`), the controls in a card. */
function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="overflow-hidden rounded-3xl bg-surface"
    >
      <div className="space-y-1 px-6 pt-6">
        <h2 id={headingId} className="font-expressive text-xl">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

function Saved({ message }: { message: string }) {
  return (
    <p
      role="status"
      className="flex items-center gap-1.5 text-sm text-muted-foreground"
    >
      <Check className="size-4" aria-hidden />
      {message}
    </p>
  );
}

function useSubmitting(...intents: string[]) {
  const navigation = useNavigation();
  const intent = navigation.formData?.get("intent");
  return (
    navigation.state === "submitting" &&
    typeof intent === "string" &&
    intents.includes(intent)
  );
}

function AvatarField({
  name,
  image,
  result,
}: {
  name: string;
  image?: string | null;
  result?: ActionResult;
}) {
  const busy = useSubmitting("avatar", "removeAvatar");
  const [preview, setPreview] = useState<string | null>(null);

  // Free the previous preview's object URL.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  return (
    <div className="flex items-center gap-4">
      <ContributorAvatar name={name} image={preview ?? image} size="xl" />
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Form
            method="post"
            encType="multipart/form-data"
            className="flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="intent" value="avatar" />
            <AvatarInput
              name="file"
              label={image ? "Change photo" : "Choose photo"}
              onChange={(file) =>
                setPreview(file ? URL.createObjectURL(file) : null)
              }
            />
            {preview && (
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? "Saving…" : "Save photo"}
              </Button>
            )}
          </Form>
          {image && !preview && (
            <Form method="post">
              <input type="hidden" name="intent" value="removeAvatar" />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                disabled={busy}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                Remove
              </Button>
            </Form>
          )}
        </div>
        {result?.error ? (
          <p role="alert" className="text-sm text-destructive">
            {result.error}
          </p>
        ) : result?.success && !busy ? (
          <Saved message={result.success} />
        ) : (
          <p className="text-xs text-muted-foreground">
            JPEG, PNG or WebP. You’ll crop it to a square.
          </p>
        )}
      </div>
    </div>
  );
}

function ProfileSection({
  user,
  avatar,
  profile,
}: {
  user: {
    name: string;
    email: string;
    image?: string | null;
    username?: string | null;
  };
  avatar?: ActionResult;
  profile?: ActionResult;
}) {
  const submitting = useSubmitting("profile");

  return (
    <SettingsSection
      title="Profile"
      description="Your photo and name are shown on the papers you contribute, and your username is in your public profile’s address."
    >
      {/* The photo has forms of its own, so it sits outside the profile form. */}
      <div className="border-b border-surface-highest p-6">
        {/* Re-mounted when the image changes, which clears the local preview. */}
        <AvatarField
          key={user.image ?? "none"}
          name={user.name}
          image={user.image}
          result={avatar}
        />
      </div>
      <Form method="post" aria-label="Profile details">
        <input type="hidden" name="intent" value="profile" />
        <div className="grid gap-4 p-6">
          <FormField
            label="Name"
            name="name"
            defaultValue={user.name}
            autoComplete="name"
            required
            maxLength={MAX_NAME}
            error={profile?.fieldErrors?.name}
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
              error={profile?.fieldErrors?.username}
            />
            <p className="text-xs text-muted-foreground">
              Your public profile: /contributors/
              {user.username ?? "your-username"}. {USERNAME_RULES}.
            </p>
          </div>
          <div className="grid gap-1.5">
            <FormField
              label="Email"
              name="email"
              type="email"
              value={user.email}
              readOnly
              disabled
            />
            <p className="text-xs text-muted-foreground">
              The Google account you log in with. Private.
            </p>
          </div>
          <FormMessage message={profile?.error} />
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-surface-highest px-6 py-4">
          {profile?.success && !submitting && (
            <Saved message={profile.success} />
          )}
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </Form>
    </SettingsSection>
  );
}

export default function AccountProfile({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user } = loaderData;
  const pick = (intent: Intent) =>
    actionData?.intent === intent ? actionData : undefined;

  return (
    <ProfileSection
      user={user}
      avatar={pick("avatar")}
      profile={pick("profile")}
    />
  );
}
