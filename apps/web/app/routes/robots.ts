/** Private areas stay out of crawls (they're noindex too). */
export function loader() {
  const body = [
    "User-agent: *",
    "Disallow: /admin",
    "Disallow: /account",
    "Disallow: /api/",
    "",
  ].join("\n");
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
