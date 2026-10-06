import { env } from "cloudflare:workers";

/**
 * The Google OAuth client the cover page maker asks for Drive access with, or
 * null while "Open in Google Docs" is off (`COVER_PAGE_GOOGLE_DOCS`, docs/PLAN.md,
 * decision 43). A web client's ID is public: it's in every sign-in link.
 */
export function googleDocsClientId(): string | null {
  return env.COVER_PAGE_GOOGLE_DOCS === "on" && env.GOOGLE_CLIENT_ID
    ? env.GOOGLE_CLIENT_ID
    : null;
}
