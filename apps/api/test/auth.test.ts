import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMAIL_DOMAIN_NOT_ALLOWED } from "@ourdiu/shared/constants";
import { account, user } from "../src/db/schema";
import { api, db, jsonRequest, ORIGIN, seedUser, signIn } from "./helpers";

/** Starts a Google sign-in and returns the Google URL and the state cookie. */
async function startGoogleSignIn(callbackURL = "/questions/contribute") {
  const res = await api(
    "/api/auth/sign-in/social",
    jsonRequest("POST", { provider: "google", callbackURL }),
  );
  expect(res.status).toBe(200);
  const { url } = await res.json<{ url: string }>();
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return { url: new URL(url), cookie };
}

/** An unsigned ID token: Better Auth reads it as is, since it comes straight from Google. */
function idToken(claims: Record<string, unknown>) {
  const part = (value: unknown) =>
    btoa(JSON.stringify(value))
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  return `${part({ alg: "none", typ: "JWT" })}.${part(claims)}.`;
}

type GoogleProfile = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
};

/**
 * Stands in for Google: its token endpoint answers with an ID token for the given
 * profile, and `photos` answers photo downloads (anything else is a 404).
 */
function mockGoogle(profile: GoogleProfile, photos: Record<string, Blob> = {}) {
  const realFetch = globalThis.fetch;
  const fetched: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith("https://lh3.googleusercontent.com/")) {
      fetched.push(url);
      const photo = photos[url];
      return Promise.resolve(
        photo ? new Response(photo) : new Response(null, { status: 404 }),
      );
    }
    if (!url.startsWith("https://oauth2.googleapis.com/token"))
      return realFetch(input, init);
    return Promise.resolve(
      Response.json({
        access_token: "google-access-token",
        token_type: "Bearer",
        expires_in: 3600,
        id_token: idToken({
          ...profile,
          email_verified: true,
          iss: "https://accounts.google.com",
          aud: "test-google-client-id",
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      }),
    );
  });
  return { fetched };
}

/**
 * Runs a whole Google sign-in: start, then Google's redirect back to the callback with
 * a code that the mocked token endpoint exchanges for the given profile.
 */
async function completeGoogleSignIn(
  profile: GoogleProfile,
  photos?: Record<string, Blob>,
) {
  const { url, cookie } = await startGoogleSignIn();
  const google = mockGoogle(profile, photos);
  const res = await api(
    `/api/auth/callback/google?code=test-code&state=${url.searchParams.get("state")}`,
    // Keep the redirect to look at, instead of following it into the API.
    { headers: { cookie }, redirect: "manual" },
  );
  return { res, fetchedPhotos: google.fetched };
}

/** The user signed in by a response's session cookie. */
async function sessionUser(res: Response) {
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const session = await api("/api/auth/get-session", { headers: { cookie } });
  return (await session.json<{ user: Record<string, unknown> }>()).user;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("auth", () => {
  it("accepts a session cookie", async () => {
    const { email, cookie } = await signIn();

    const res = await api("/api/auth/get-session", { headers: { cookie } });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ user: { email } });
  });

  it("has no email/password sign-up or sign-in", async () => {
    const body = {
      name: "Someone",
      email: `pw-${crypto.randomUUID()}@example.com`,
      password: "correct-horse-battery",
    };
    const signUp = await api(
      "/api/auth/sign-up/email",
      jsonRequest("POST", body),
    );
    const signInRes = await api(
      "/api/auth/sign-in/email",
      jsonRequest("POST", body),
    );

    expect(signUp.ok).toBe(false);
    expect(signInRes.ok).toBe(false);
  });

  it("sends Google sign-ins back to the web origin's callback", async () => {
    const { url, cookie } = await startGoogleSignIn();

    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("test-google-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      `${ORIGIN}/api/auth/callback/google`,
    );
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(cookie).not.toBe("");
  });

  it("links a Google sign-in to the imported user with that email", async () => {
    // Like a user imported from the old site: email verified, no Google account yet.
    const existing = await seedUser("Existing Contributor");
    await db()
      .update(user)
      .set({ emailVerified: true })
      .where(eq(user.id, existing.id));

    const { res } = await completeGoogleSignIn({
      sub: `google-${existing.id}`,
      email: existing.email,
      name: "Name From Google",
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/questions/contribute");
    expect(await sessionUser(res)).toMatchObject({
      id: existing.id,
      name: "Existing Contributor",
    });
    const accounts = await db()
      .select({ providerId: account.providerId })
      .from(account)
      .where(eq(account.userId, existing.id));
    expect(accounts).toEqual([{ providerId: "google" }]);
  });

  it("creates a verified user on the first Google sign-in", async () => {
    const email = `new-${crypto.randomUUID()}@s.diu.edu.bd`;

    const { res } = await completeGoogleSignIn({
      sub: `google-${email}`,
      email,
      name: "New Contributor",
    });

    expect(res.status).toBe(302);
    expect(await sessionUser(res)).toMatchObject({
      email,
      name: "New Contributor",
      emailVerified: true,
      role: "user",
    });
  });

  describe("DIU email rule", () => {
    /** Where a refused sign-in is sent: the login page, with the reason. */
    const refusal = (res: Response) => {
      expect(res.status).toBe(302);
      const location = new URL(res.headers.get("location")!, ORIGIN);
      return location.searchParams.get("error");
    };

    it("refuses a new account on another domain, without creating it", async () => {
      const email = `outsider-${crypto.randomUUID()}@gmail.com`;
      const { res } = await completeGoogleSignIn({
        sub: `google-${email}`,
        email,
        name: "Outsider",
      });

      expect(refusal(res)).toBe(EMAIL_DOMAIN_NOT_ALLOWED);
      expect(res.headers.getSetCookie().join()).not.toContain("session_token=");
      const rows = await db().select().from(user).where(eq(user.email, email));
      expect(rows).toEqual([]);
    });

    it("lets an existing account on another domain in", async () => {
      const existing = await seedUser("Old Contributor");
      const email = `old-${existing.id}@gmail.com`;
      await db()
        .update(user)
        .set({ email, emailVerified: true })
        .where(eq(user.id, existing.id));

      const { res } = await completeGoogleSignIn({
        sub: `google-${existing.id}`,
        email,
        name: "Old Contributor",
      });

      expect(res.headers.get("location")).toBe("/questions/contribute");
      expect(await sessionUser(res)).toMatchObject({ id: existing.id });
    });
  });

  it("lets an ADMIN_EMAILS address sign up, as an admin", async () => {
    // boss@gmail.com is in ADMIN_EMAILS (vitest.config.ts).
    const { res } = await completeGoogleSignIn({
      sub: "google-boss",
      email: "boss@gmail.com",
      name: "The Boss",
    });

    expect(res.status).toBe(302);
    expect(await sessionUser(res)).toMatchObject({
      email: "boss@gmail.com",
      role: "admin",
    });
  });

  describe("Google photo", () => {
    const JPEG = new Blob([
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]),
    ]);
    const sized = "https://lh3.googleusercontent.com/a/photo-id=s96-c";
    const fullSize = "https://lh3.googleusercontent.com/a/photo-id";
    const newProfile = () => {
      const email = `photo-${crypto.randomUUID()}@diu.edu.bd`;
      return {
        sub: `google-${email}`,
        email,
        name: "Photo User",
        picture: sized,
      };
    };

    it("stores the full-size photo and serves it from our own URL", async () => {
      const { res, fetchedPhotos } = await completeGoogleSignIn(newProfile(), {
        [fullSize]: JPEG,
      });

      expect(fetchedPhotos).toEqual([fullSize]);
      const { image } = (await sessionUser(res)) as { image: string };
      expect(image).toMatch(/^\/api\/v1\/avatars\/[\w-]+$/);
      const served = await api(image);
      expect(served.status).toBe(200);
      expect(served.headers.get("content-type")).toBe("image/jpeg");
    });

    it("falls back to the size Google sent", async () => {
      const { res, fetchedPhotos } = await completeGoogleSignIn(newProfile(), {
        [sized]: JPEG,
      });

      expect(fetchedPhotos).toEqual([fullSize, sized]);
      expect((await sessionUser(res)).image).toMatch(/^\/api\/v1\/avatars\//);
    });

    it("keeps Google's URL when the photo can't be copied", async () => {
      const { res } = await completeGoogleSignIn(newProfile());

      expect(res.status).toBe(302);
      expect((await sessionUser(res)).image).toBe(sized);
    });
  });
});
