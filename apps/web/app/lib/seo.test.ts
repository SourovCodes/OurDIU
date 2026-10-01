import { describe, expect, it } from "vitest";
import { robotsTxt, sitemapXml } from "./seo";

const SITE = "https://example.com";

describe("sitemapXml", () => {
  it("lists the static pages, questions and contributors", () => {
    const xml = sitemapXml(SITE, {
      questions: [{ id: 7, lastModified: "2026-01-02T03:04:05.000Z" }],
      contributors: [{ username: "a&b" }],
    });
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset /);
    expect(xml).toContain(`<url><loc>${SITE}/</loc></url>`);
    expect(xml).toContain(`<url><loc>${SITE}/questions</loc></url>`);
    expect(xml).toContain(`<url><loc>${SITE}/contact</loc></url>`);
    expect(xml).toContain(`<url><loc>${SITE}/privacy</loc></url>`);
    expect(xml).toContain(
      `<url><loc>${SITE}/questions/7</loc><lastmod>2026-01-02T03:04:05.000Z</lastmod></url>`,
    );
    expect(xml).toContain(`<loc>${SITE}/questions/contributors/a%26b</loc>`);
    expect(xml.trimEnd()).toMatch(/<\/urlset>$/);
  });
});

describe("robotsTxt", () => {
  it("points crawlers at the sitemap and keeps private areas out", () => {
    const txt = robotsTxt(SITE);
    expect(txt).toContain("Disallow: /admin\n");
    expect(txt).toContain("Disallow: /account\n");
    expect(txt).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });
});
