// A thin client for the Cloudflare Realtime SFU's HTTPS API, used by course rooms
// (course-room.ts): the browser sends its offers and answers through the room,
// which holds the app's token and decides whose tracks a person may hear.

const SFU_API = "https://rtc.live.cloudflare.com/v1/apps";

export type SessionDescription = { type: "offer" | "answer"; sdp: string };

export type SfuTrackRequest =
  | { location: "local"; mid: string; trackName: string }
  | { location: "remote"; sessionId: string; trackName: string };

export type SfuTracksResponse = {
  requiresImmediateRenegotiation?: boolean;
  sessionDescription?: SessionDescription;
  tracks?: {
    mid?: string;
    trackName?: string;
    sessionId?: string;
    errorCode?: string;
    errorDescription?: string;
  }[];
  errorCode?: string;
  errorDescription?: string;
};

/** Cloudflare refused a call: its status, its error code and which call it was. */
export class SfuError extends Error {
  constructor(
    readonly step: string,
    readonly status: number,
    readonly errorCode?: string,
    readonly errorDescription?: string,
  ) {
    super(
      `SFU ${step}: ${status} ${errorCode ?? ""} ${errorDescription ?? ""}`.trim(),
    );
  }

  /** "401 at sessions/new", for admins' toasts and the admin check. */
  get short() {
    const where = this.step
      .replace(/^\w+ \//, "")
      .replace(/^sessions\/[^/]+\//, "");
    return `${this.status}${this.errorCode ? ` ${this.errorCode}` : ""} at ${where}`;
  }
}

export function createSfu(appId: string, token: string) {
  // A value saved with a trailing newline would otherwise fail every call.
  const base = `${SFU_API}/${appId.trim()}`;
  const authorization = `Bearer ${token.trim()}`;

  async function call<T>(method: string, path: string, body?: unknown) {
    const res = await fetch(`${base}${path}`, {
      method,
      // No content type without a body: creating a session sends none.
      headers:
        body === undefined
          ? { authorization }
          : { authorization, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as T & {
      errorCode?: string;
      errorDescription?: string;
    };
    if (!res.ok || data.errorCode) {
      throw new SfuError(
        `${method} ${path}`,
        res.status,
        data.errorCode,
        data.errorDescription,
      );
    }
    return data;
  }

  return {
    async newSession() {
      const { sessionId } = await call<{ sessionId: string }>(
        "POST",
        "/sessions/new",
      );
      return sessionId;
    },
    /** Pushes local tracks (with the client's offer) or pulls remote ones. */
    tracks(
      sessionId: string,
      tracks: SfuTrackRequest[],
      sessionDescription?: SessionDescription,
    ) {
      return call<SfuTracksResponse>(
        "POST",
        `/sessions/${sessionId}/tracks/new`,
        {
          ...(sessionDescription && { sessionDescription }),
          tracks,
        },
      );
    },
    renegotiate(sessionId: string, sessionDescription: SessionDescription) {
      return call<unknown>("PUT", `/sessions/${sessionId}/renegotiate`, {
        sessionDescription,
      });
    },
  };
}

export type Sfu = ReturnType<typeof createSfu>;
