import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import {
  EMAIL_DOMAIN_NOT_ALLOWED,
  isAllowedEmail,
} from "@ourdiu/shared/constants";
import { APIError, betterAuth, type BetterAuthOptions } from "better-auth";
import { bearer } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import * as schema from "../db/schema";
import { user } from "../db/schema";
import { importGoogleAvatar } from "../services/avatars";

/** A sign-up refused by the DIU email rule; the login page explains it. */
const notAllowed = () =>
  new APIError("FORBIDDEN", {
    code: EMAIL_DOMAIN_NOT_ALLOWED,
    message: "Only DIU email addresses can create an account",
  });

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
 * product. New accounts need a DIU address (ALLOWED_EMAIL_DOMAINS) unless they're in
 * ADMIN_EMAILS, which also makes them admins; existing accounts can always sign in. Exported on its own so tests can build an auth
 * instance with the same options plus Better Auth's `testUtils` plugin.
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
    databaseHooks: {
      user: {
        create: {
          // The DIU rule only applies to new accounts: anyone who already has one
          // can sign in whatever their email. Refused before the account exists, so
          // no stray users are left behind.
          before: async (created) => {
            const isAdmin = adminEmails(env).has(created.email.toLowerCase());
            if (!isAdmin && !isAllowedEmail(created.email)) throw notAllowed();
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
