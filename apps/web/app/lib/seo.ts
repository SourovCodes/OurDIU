import type { Sitemap } from "@ourdiu/shared";
import { LEGAL_PAGES } from "./legal";

/** Public pages that always exist, with no data behind them. */
const STATIC_PATHS = [
  "/",
  "/questions",
  "/questions/browse",
  "/questions/contributors",
  "/app",
  "/about",
  "/contact",
  "/delete-account",
  ...LEGAL_PAGES.map((page) => page.path),
];

function escapeXml(text: string) {
  return text.replace(
    /[<>&'"]/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&apos;",
        '"': "&quot;",
      })[c]!,
  );
}

function urlEntry(loc: string, lastModified?: string) {
  const lastmod = lastModified ? `<lastmod>${lastModified}</lastmod>` : "";
  return `<url><loc>${escapeXml(loc)}</loc>${lastmod}</url>`;
}

/** sitemap.xml (sitemaps.org protocol) for the site at `origin`. */
export function sitemapXml(origin: string, sitemap: Sitemap) {
  const entries = [
    ...STATIC_PATHS.map((path) => urlEntry(origin + path)),
    ...sitemap.questions.map((q) =>
      urlEntry(`${origin}/questions/${q.id}`, q.lastModified),
    ),
    ...sitemap.contributors.map((c) =>
      urlEntry(
        `${origin}/questions/contributors/${encodeURIComponent(c.username)}`,
      ),
    ),
  ];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");
}

/**
 * robots.txt: private areas stay out of crawls (they are noindex too), and the API
 * is left to the pages that link to it.
 */
export function robotsTxt(origin: string) {
  return [
    "User-agent: *",
    "Disallow: /admin",
    "Disallow: /account",
    "Disallow: /questions/my-submissions",
    "Disallow: /api/",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
}
