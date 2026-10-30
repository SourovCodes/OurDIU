// Passkeys run in the browser: only it can talk to the device's authenticator. So,
// unlike the rest of the site, these call Better Auth's passkey endpoints straight
// from the page (same origin, the session cookie goes along) instead of through an
// action. `@simplewebauthn/browser` is loaded on the first click, keeping it out of
// the page's first load (docs/PLAN.md, decision 70).

/** Better Auth's error body. */
type AuthError = { code?: string; message?: string };

/** What the user sees when a passkey step fails. */
export class PasskeyError extends Error {}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/auth/passkey/${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    ...(body === undefined
      ? {}
      : {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  if (res.ok) return (await res.json()) as T;
  const error = (await res.json().catch(() => null)) as AuthError | null;
  throw new PasskeyError(messageFor(error?.code));
}

function messageFor(code: string | undefined) {
  switch (code) {
    case "SESSION_NOT_FRESH":
      return "For your security, log out and log in with Google again, then add your passkey.";
    case "PASSKEY_NOT_FOUND":
      return "That passkey isn’t on an OurDIU account. Log in with Google, then add it on your Account page.";
    case "CHALLENGE_NOT_FOUND":
      return "That took too long. Please try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

/** The browser's own errors: cancelled, a passkey already added, no support. */
function browserError(error: unknown, cancelled: string): never {
  if (error instanceof PasskeyError) throw error;
  const name = error instanceof Error ? error.name : "";
  const code = (error as { code?: string } | null)?.code;
  if (code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") {
    throw new PasskeyError(
      "This device already has a passkey for your account.",
    );
  }
  if (name === "NotAllowedError" || name === "AbortError") {
    throw new PasskeyError(cancelled);
  }
  if (!window.PublicKeyCredential) {
    throw new PasskeyError("This browser doesn’t support passkeys.");
  }
  throw new PasskeyError(
    "Your device couldn’t use a passkey. Please try again.",
  );
}

/** Makes a passkey on this device for the signed-in user. */
export async function addPasskey() {
  try {
    const { startRegistration } = await import("@simplewebauthn/browser");
    const optionsJSON = await call<
      Parameters<typeof startRegistration>[0]["optionsJSON"]
    >("generate-register-options");
    const response = await startRegistration({ optionsJSON });
    await call("verify-registration", { response });
  } catch (error) {
    browserError(error, "Adding the passkey was cancelled.");
  }
}

/** Logs in with a passkey the user picks; the response sets the session cookie. */
export async function logInWithPasskey() {
  try {
    const { startAuthentication } = await import("@simplewebauthn/browser");
    const optionsJSON = await call<
      Parameters<typeof startAuthentication>[0]["optionsJSON"]
    >("generate-authenticate-options");
    const response = await startAuthentication({ optionsJSON });
    await call("verify-authentication", { response });
  } catch (error) {
    browserError(error, "Passkey log-in was cancelled.");
  }
}
