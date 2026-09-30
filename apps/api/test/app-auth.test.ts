import { env, exports } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { EMAIL_DOMAIN_NOT_ALLOWED } from "@ourdiu/shared/constants";
import { user } from "../src/db/schema";
import { db } from "./helpers";

/**
 * The mobile app's sign-in: an ID token from Google on the phone, swapped for a
 * session token it sends as a bearer token. The app sends no Origin header and no
 * cookies, so requests here are built without the `api()` helper's Origin.
 */
function app(path: string, init: RequestInit = {}) {
  return exports.default.fetch(
    new Request(`${new URL(env.SITE_URL).origin}${path}`, init),
  );
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

let keys: CryptoKeyPair;
const KID = "test-key";

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
const encode = (value: unknown) =>
  base64url(new TextEncoder().encode(JSON.stringify(value)));

/** An RS256 ID token signed with the key Google's (mocked) JWKS endpoint serves. */
async function googleIdToken(claims: Record<string, unknown>) {
  const now = Math.floor(Date.now() / 1000);
  const input = `${encode({ alg: "RS256", kid: KID, typ: "JWT" })}.${encode({
    iss: "https://accounts.google.com",
    aud: "test-google-client-id",
    iat: now,
    exp: now + 3600,
    email_verified: true,
    ...claims,
  })}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    keys.privateKey,
    new TextEncoder().encode(input),
  );
  return `${input}.${base64url(new Uint8Array(signature))}`;
}

beforeAll(async () => {
  keys = (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
});

/** Google's JWKS endpoint, serving the test key. */
async function mockGoogleKeys() {
  const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
  const realFetch = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith("https://www.googleapis.com/oauth2/v3/certs")) {
      return Promise.resolve(
        Response.json({
          keys: [{ ...jwk, kid: KID, alg: "RS256", use: "sig" }],
        }),
      );
    }
    return realFetch(input, init);
  });
}

function signInWithIdToken(token: string) {
  return app("/api/auth/sign-in/social", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: "google", idToken: { token } }),
  });
}

const profile = (email = `app-${crypto.randomUUID()}@diu.edu.bd`) => ({
  sub: `google-${email}`,
  email,
  name: "App User",
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("app sign-in", () => {
  it("swaps a Google ID token for a bearer token", async () => {
    await mockGoogleKeys();
    const claims = profile();

    const res = await signInWithIdToken(await googleIdToken(claims));

    expect(res.status).toBe(200);
    const token = res.headers.get("set-auth-token");
    expect(token).toBeTruthy();
    const session = await app("/api/auth/get-session", {
      headers: bearer(token!),
    });
    expect(await session.json()).toMatchObject({
      user: { email: claims.email, name: "App User", role: "user" },
    });
    // Protected API routes take it too.
    const mine = await app("/api/v1/me", {
      headers: bearer(token!),
    });
    expect(mine.status).toBe(200);
  });

  it("refuses a new account on another domain, without creating it", async () => {
    await mockGoogleKeys();
    const claims = profile(`outsider-${crypto.randomUUID()}@gmail.com`);

    const res = await signInWithIdToken(await googleIdToken(claims));

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: EMAIL_DOMAIN_NOT_ALLOWED });
    expect(res.headers.get("set-auth-token")).toBeNull();
    const rows = await db()
      .select()
      .from(user)
      .where(eq(user.email, claims.email));
    expect(rows).toEqual([]);
  });

  it("refuses an ID token issued to another app", async () => {
    await mockGoogleKeys();

    const res = await signInWithIdToken(
      await googleIdToken({ ...profile(), aud: "someone-elses-client-id" }),
    );

    expect(res.ok).toBe(false);
    expect(res.headers.get("set-auth-token")).toBeNull();
  });

  it("refuses an ID token that isn't signed by Google", async () => {
    await mockGoogleKeys();
    const token = await googleIdToken(profile());
    const [header, payload] = token.split(".");

    const res = await signInWithIdToken(`${header}.${payload}.`);

    expect(res.ok).toBe(false);
  });

  it("ignores a bearer token without its signature", async () => {
    await mockGoogleKeys();
    const res = await signInWithIdToken(await googleIdToken(profile()));
    const [unsigned] = res.headers.get("set-auth-token")!.split(".");

    const session = await app("/api/auth/get-session", {
      headers: bearer(unsigned!),
    });
    expect(await session.json()).toBeNull();
  });

  it("signs out, after which the token no longer works", async () => {
    await mockGoogleKeys();
    const res = await signInWithIdToken(await googleIdToken(profile()));
    const token = res.headers.get("set-auth-token")!;

    const out = await app("/api/auth/sign-out", {
      method: "POST",
      headers: bearer(token),
    });

    expect(out.status).toBe(200);
    const mine = await app("/api/v1/me", {
      headers: bearer(token),
    });
    expect(mine.status).toBe(401);
  });
});
