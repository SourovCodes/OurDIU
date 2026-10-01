// View counts are public and unauthenticated, and most visitors share a few campus
// IP addresses, so they can't be limited per address. Instead a view only counts
// with a token from the question page itself: `GET /questions/{id}` signs one, and
// the page sends it back. A token counts each page at most once a minute (the
// VIEW_LIMITER binding, keyed by token), so a script has to load the question again
// for each view it wants counted, like a visitor does, rather than replay one token.

/** How long a question page's token counts views (a visitor reading for a while). */
export const VIEW_TOKEN_TTL_MS = 60 * 60 * 1000;

const encoder = new TextEncoder();

function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

// Prefixed so a view token can never be mistaken for another signature made with
// the same secret (Better Auth's cookies).
const payload = (questionId: number, issuedAt: number) =>
  encoder.encode(`qb-view:${questionId}.${issuedAt}`);

const toBase64Url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

function fromBase64Url(text: string) {
  try {
    const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

/** A token for counting views of question `questionId` and its papers. */
export async function createViewToken(
  secret: string,
  questionId: number,
  now = Date.now(),
) {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    payload(questionId, now),
  );
  return `${now}.${toBase64Url(signature)}`;
}

/** Whether `token` was issued for question `questionId` within the last hour. */
export async function verifyViewToken(
  secret: string,
  token: string | undefined,
  questionId: number,
  now = Date.now(),
) {
  const [issued, signature, ...rest] = token?.split(".") ?? [];
  const issuedAt = Number(issued);
  const bytes = signature ? fromBase64Url(signature) : null;
  if (rest.length > 0 || !Number.isSafeInteger(issuedAt) || !bytes) {
    return false;
  }
  // A little leeway for clocks that differ between Cloudflare locations.
  const age = now - issuedAt;
  if (age < -60_000 || age > VIEW_TOKEN_TTL_MS) return false;
  return crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    bytes,
    payload(questionId, issuedAt),
  );
}

// Crawlers, HTTP libraries and headless browsers. Search engines see the view count
// on the page, but their visits shouldn't raise it.
const AUTOMATED_AGENT =
  /bot|crawl|spider|slurp|preview|headless|curl|wget|python|httpie|http-client|httpclient|okhttp|axios|node-fetch|undici|go-http|java\/|libwww|scrapy|phantomjs|selenium|puppeteer|playwright/i;

/**
 * Whether a view request comes from a person's browser (or app): a user agent that
 * isn't an automated one and, when the browser says so, a request from this site
 * rather than another one. Checked before anything that costs a D1 read.
 */
export function isBrowserRequest(headers: {
  userAgent: string | undefined;
  fetchSite: string | undefined;
}) {
  if (!headers.userAgent || AUTOMATED_AGENT.test(headers.userAgent)) {
    return false;
  }
  return !headers.fetchSite || headers.fetchSite === "same-origin";
}
