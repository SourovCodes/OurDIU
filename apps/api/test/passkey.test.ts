import { describe, expect, it } from "vitest";
import { passkey } from "../src/db/schema";
import { api, db, jsonRequest, signIn } from "./helpers";

/** Stores a passkey for a user directly; registering one needs a real authenticator. */
async function seedPasskey(userId: string) {
  const [row] = await db()
    .insert(passkey)
    .values({
      id: crypto.randomUUID(),
      userId,
      publicKey: "public-key",
      credentialID: crypto.randomUUID(),
      counter: 0,
      deviceType: "multiDevice",
      backedUp: true,
      createdAt: new Date(),
    })
    .returning();
  return row!;
}

/** The cookies a response set, as a Cookie header value. */
function cookiesFrom(res: Response) {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

describe("passkeys", () => {
  it("are added only by a signed-in user, as discoverable credentials for the site", async () => {
    const signedOut = await api("/api/auth/passkey/generate-register-options");
    expect(signedOut.status).toBe(401);

    const { cookie, email } = await signIn();
    const res = await api("/api/auth/passkey/generate-register-options", {
      headers: { cookie },
    });
    expect(res.status).toBe(200);
    const options = await res.json<{
      rp: { id: string; name: string };
      user: { name: string };
      authenticatorSelection: { residentKey: string };
    }>();
    expect(options.rp).toEqual({ id: "localhost", name: "OurDIU" });
    expect(options.user.name).toBe(email);
    expect(options.authenticatorSelection.residentKey).toBe("required");
  });

  it("offers a passkey log-in to signed-out visitors and refuses an unknown passkey", async () => {
    const options = await api(
      "/api/auth/passkey/generate-authenticate-options",
    );
    expect(options.status).toBe(200);
    expect(await options.json()).toMatchObject({ rpId: "localhost" });

    const res = await api(
      "/api/auth/passkey/verify-authentication",
      jsonRequest(
        "POST",
        { response: { id: "unknown", rawId: "unknown", type: "public-key" } },
        cookiesFrom(options),
      ),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "PASSKEY_NOT_FOUND" });
  });

  it("are listed and removed only by their owner", async () => {
    const owner = await signIn();
    const other = await signIn();
    const key = await seedPasskey(owner.id);

    const list = (cookie: string) =>
      api("/api/auth/passkey/list-user-passkeys", { headers: { cookie } }).then(
        (res) => res.json<{ id: string }[]>(),
      );
    expect((await list(owner.cookie)).map((p) => p.id)).toEqual([key.id]);
    expect(await list(other.cookie)).toEqual([]);

    const stolen = await api(
      "/api/auth/passkey/delete-passkey",
      jsonRequest("POST", { id: key.id }, other.cookie),
    );
    expect(stolen.ok).toBe(false);
    expect(await list(owner.cookie)).toHaveLength(1);

    const removed = await api(
      "/api/auth/passkey/delete-passkey",
      jsonRequest("POST", { id: key.id }, owner.cookie),
    );
    expect(removed.status).toBe(200);
    expect(await list(owner.cookie)).toEqual([]);
  });
});
