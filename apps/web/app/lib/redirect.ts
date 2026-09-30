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
 * A redirect to the same path on the site's own host (`SITE_URL`), for requests that
 * reach the Worker another way: `www.`, or its workers.dev address. Auth only trusts
 * SITE_URL's origin, so the site must not be used from elsewhere. Only for https sites,
 * so local dev and tests (http://localhost) are left alone. 308 keeps the method.
 */
export function canonicalHostRedirect(request: Request, siteUrl: string) {
  const site = new URL(siteUrl);
  const url = new URL(request.url);
  if (site.protocol !== "https:" || url.host === site.host) return null;
  const to = new URL(url.pathname + url.search, site.origin);
  const status =
    request.method === "GET" || request.method === "HEAD" ? 301 : 308;
  return Response.redirect(to.toString(), status);
}
