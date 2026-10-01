/** Only allows same-site relative paths, preventing open redirects via `?redirectTo=`. */
export function safeRedirect(
  to: FormDataEntryValue | string | null | undefined,
  fallback = "/",
) {
  if (
    typeof to !== "string" ||
    !to.startsWith("/") ||
    to.startsWith("//") ||
    to.startsWith("/\\")
  ) {
    return fallback;
  }
  return to;
}

/**
 * The question bank's old site. Its pages now live under /questions here, and its
 * API is still served there unchanged: installed copies of the app call it.
 */
const LEGACY_HOSTS = new Set(["diuqbank.com", "www.diuqbank.com"]);

/** Where a page of the old question bank site lives now. */
export function legacyPath(pathname: string): string {
  if (pathname === "/") return "/questions";
  if (pathname === "/questions") return "/questions/browse";
  if (pathname === "/contribute") return "/questions/contribute";
  if (pathname === "/contributors" || pathname.startsWith("/contributors/")) {
    return `/questions${pathname}`;
  }
  if (pathname.startsWith("/account/submissions")) {
    return pathname.replace(
      "/account/submissions",
      "/questions/my-submissions",
    );
  }
  return pathname;
}

/**
 * A redirect to the site's own host (`SITE_URL`), for requests that reach the
 * Worker another way: `www.`, its workers.dev address, or the old question bank
 * domain (whose pages are mapped to their new paths, and whose API is served as
 * is). Auth only trusts SITE_URL's origin, so the site must not be used from
 * elsewhere. Only for https sites, so local dev and tests (http://localhost) are
 * left alone. 308 keeps the method.
 */
export function canonicalHostRedirect(request: Request, siteUrl: string) {
  const site = new URL(siteUrl);
  const url = new URL(request.url);
  if (site.protocol !== "https:" || url.host === site.host) return null;
  const legacy = LEGACY_HOSTS.has(url.hostname);
  if (legacy && url.pathname.startsWith("/api/")) return null;
  const path = legacy ? legacyPath(url.pathname) : url.pathname;
  const to = new URL(path + url.search, site.origin);
  const status =
    request.method === "GET" || request.method === "HEAD" ? 301 : 308;
  return Response.redirect(to.toString(), status);
}
