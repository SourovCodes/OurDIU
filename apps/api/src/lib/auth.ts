import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { bearer } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import * as schema from "../db/schema";
import { user } from "../db/schema";
import { importGoogleAvatar } from "../services/avatars";

/** A new user's username until they pick one, like the old site's: `user_1a2b3c`. */
function generateUsername(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(3));
  return `user_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** A generated username nobody has yet. */
async function freshUsername(db: Database): Promise<string> {
  for (;;) {
    const username = generateUsername();
    const [taken] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.username, username));
    if (!taken) return username;
  }
}

/** The addresses in ADMIN_EMAILS (comma-separated), lowercased. */
export function adminEmails(env: Env): Set<string> {
  return new Set(
    (env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * The Google OAuth clients whose ID tokens are accepted: GOOGLE_CLIENT_ID first (the
 * site's sign-in uses it), then GOOGLE_EXTRA_CLIENT_IDS (comma-separated), e.g. the
 * old question bank client that installed copies of the app still sign in with.
 */
export function googleClientIds(env: Env): string[] {
  return [
    env.GOOGLE_CLIENT_ID,
    ...(env.GOOGLE_EXTRA_CLIENT_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  ];
}

/**
 * Google is the only way to sign in, and one account works across every OurDIU
 * product. Any Google account can sign up; contributing papers needs a DIU address
 * (`canContribute`, checked by the routes). New accounts in ADMIN_EMAILS are made
 * admins. Exported on its own so tests can build an auth instance with the same
 * options plus Better Auth's `testUtils` plugin.
 *
 * The site signs in through Google's redirect and keeps the session in a cookie. The
 * mobile app gets an ID token from Google on the phone, sends it to
 * `/api/auth/sign-in/social` (its audience is the same web client ID), and keeps the
 * session token from the `set-auth-token` response header, which it then sends as
 * `Authorization: Bearer <token>` (the `bearer` plugin).
 */
export function authOptions(env: Env, db: Database) {
  return {
    appName: "OurDIU",
    baseURL: new URL(env.SITE_URL).origin,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [new URL(env.SITE_URL).origin],
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    user: {
      additionalFields: {
        // Returned with the session. `input: false` keeps it out of sign-up and
        // update-user, so only an admin (or `pnpm make-admin`) can change it.
        role: {
          type: "string",
          required: false,
          defaultValue: "user",
          input: false,
        },
        // Changed through /api/v1/me/username, which validates it.
        username: { type: "string", required: false, input: false },
      },
    },
    hooks: {
      // Images are set only through /api/v1/me/avatar, which stores them itself.
      // Through update-user, a user could show any URL on their public profile, or
      // point at someone else's stored image, which replacing theirs would delete.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/update-user" && ctx.body?.image !== undefined) {
          throw new APIError("BAD_REQUEST", {
            message: "Change your profile image at /api/v1/me/avatar",
          });
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (created) => {
            const isAdmin = adminEmails(env).has(created.email.toLowerCase());
            return {
              data: {
                ...created,
                username: await freshUsername(db),
                ...(isAdmin ? { role: "admin" } : {}),
              },
            };
          },
          // Google gives a new user its photo URL; keep a copy of our own instead.
          after: async (created) => {
            if (created.image) {
              await importGoogleAvatar(
                db,
                env.BUCKET,
                env.FILES_URL,
                created.id,
                created.image,
              );
            }
          },
        },
      },
    },
    plugins: [bearer({ requireSignature: true })],
    socialProviders: {
      google: {
        clientId: googleClientIds(env),
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        prompt: "select_account",
      },
    },
  } satisfies BetterAuthOptions;
}

// Workers have no long-lived process, and bindings are only available per request,
// so the auth instance is built from the request's env instead of a module singleton.
export function createAuth(env: Env, db: Database) {
  return betterAuth(authOptions(env, db));
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = Auth["$Infer"]["Session"];
