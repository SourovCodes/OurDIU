import type { RoomVoiceCheck } from "@ourdiu/shared";
import { createSfu, SfuError } from "./sfu";
import { roomLimits } from "./usage";

/**
 * Asks Cloudflare's SFU for a session, as a call would, and says what came back:
 * the admin's way to check REALTIME_APP_ID and REALTIME_APP_TOKEN. The session is
 * never used; Cloudflare drops it on its own.
 */
export async function checkVoiceSetup(env: Env): Promise<RoomVoiceCheck> {
  if (!roomLimits(env).voiceAvailable) {
    return {
      ok: false,
      status: 0,
      errorCode: "NOT_SET_UP",
      message: "REALTIME_APP_ID or the REALTIME_APP_TOKEN secret isn't set.",
    };
  }
  try {
    await createSfu(env.REALTIME_APP_ID, env.REALTIME_APP_TOKEN).newSession();
    return {
      ok: true,
      status: 200,
      errorCode: null,
      message: "Voice is set up: Cloudflare created a test session.",
    };
  } catch (error) {
    if (!(error instanceof SfuError)) {
      return {
        ok: false,
        status: 0,
        errorCode: "UNREACHABLE",
        message: "Couldn't reach Cloudflare's SFU. Try again in a minute.",
      };
    }
    const { status, errorCode = null } = error;
    const message =
      status === 401 || status === 403
        ? "Cloudflare refused the token: set the REALTIME_APP_TOKEN secret to the SFU app's secret again."
        : status === 404
          ? "Cloudflare has no SFU app with this ID: check REALTIME_APP_ID in wrangler.jsonc."
          : `Cloudflare answered ${error.short}${error.errorDescription ? `: ${error.errorDescription}` : ""}.`;
    return { ok: false, status, errorCode, message };
  }
}
