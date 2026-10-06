// "Open in Google Docs" for the cover page maker (docs/PLAN.md, decision 43): the
// .docx goes to the student's own Google Drive, converted to a Google Doc, with
// Google's token client and only the drive.file scope (files this site creates).
// The token stays in the browser; OurDIU's server never sees it.

const GIS_SRC = "https://accounts.google.com/gsi/client";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const GOOGLE_DOC = "application/vnd.google-apps.document";
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
};
type TokenClient = { requestAccessToken: (o?: { prompt?: string }) => void };
type GoogleOAuth = {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type?: string }) => void;
  }) => TokenClient;
};

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth } };
  }
}

let loading: Promise<GoogleOAuth> | null = null;

/** Loads Google's script once; call it early, so the click can open its popup. */
export function loadGoogleIdentity(): Promise<GoogleOAuth> {
  loading ??= new Promise((resolve, reject) => {
    const ready = () => {
      const oauth2 = window.google?.accounts?.oauth2;
      if (oauth2) resolve(oauth2);
      else reject(new Error("Google's sign-in script didn't load"));
    };
    if (window.google?.accounts?.oauth2) return ready();
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = ready;
    script.onerror = () => {
      loading = null;
      reject(new Error("Google's sign-in script didn't load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

let token: { value: string; expires: number } | null = null;

/**
 * Why Google gave no access: the student said no or closed its window
 * ("declined"), or the browser blocked the window ("blocked").
 */
export class DriveAccessError extends Error {
  constructor(readonly reason: "declined" | "blocked") {
    super(`Google Drive access ${reason}`);
  }
}

/**
 * Asks Google for Drive access (a popup the first time; later ones reuse the
 * token while it lasts). Must start from a click, with the script loaded.
 */
export function driveToken(
  oauth2: GoogleOAuth,
  clientId: string,
): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) {
    return Promise.resolve(token.value);
  }
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (response) => {
        if (!response.access_token) {
          // "access_denied" when the student says no.
          reject(new DriveAccessError("declined"));
          return;
        }
        token = {
          value: response.access_token,
          expires: Date.now() + (response.expires_in ?? 3600) * 1000,
        };
        resolve(response.access_token);
      },
      error_callback: (error) =>
        reject(
          new DriveAccessError(
            error.type === "popup_failed_to_open" ? "blocked" : "declined",
          ),
        ),
    });
    client.requestAccessToken();
  });
}

/** Uploads a .docx to the student's Drive as a Google Doc; returns its link. */
export async function saveAsGoogleDoc(
  accessToken: string,
  docx: Blob,
  name: string,
): Promise<string> {
  const boundary = `ourdiu-${crypto.randomUUID()}`;
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify({ name, mimeType: GOOGLE_DOC }),
    `\r\n--${boundary}\r\nContent-Type: ${DOCX}\r\n\r\n`,
    docx,
    `\r\n--${boundary}--`,
  ]);
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) {
    if (res.status === 401) token = null;
    throw new Error(`Google Drive answered ${res.status}`);
  }
  const file = (await res.json()) as { id: string; webViewLink?: string };
  return (
    file.webViewLink ?? `https://docs.google.com/document/d/${file.id}/edit`
  );
}
