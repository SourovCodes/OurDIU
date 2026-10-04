import { describe, expect, it } from "vitest";
import {
  breadcrumbJsonLd,
  canonicalUrl,
  llmsTxt,
  originOf,
  robotsTxt,
  sitemapXml,
} from "./seo";

const SITE = "https://example.com";

describe("sitemapXml", () => {
  it("lists the static pages, departments, courses, questions and contributors", () => {
    const xml = sitemapXml(
      SITE,
      {
        questions: [{ id: 7, lastModified: "2026-01-02T03:04:05.000Z" }],
        contributors: [{ username: "a&b" }],
      },
      {
        departmentIds: [3],
        courseIds: [12],
        routine: [
          { department: "eee", sections: ["1-2 B"], teachers: ["ShA"] },
        ],
      },
    );
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset /);
    // The hub, since the Class Routine launched (HUB_LIVE).
    expect(xml).toContain(`<url><loc>${SITE}/</loc></url>`);
    // A live routine's home, teachers, sections and teachers' weeks.
    expect(xml).toContain(`<url><loc>${SITE}/routine</loc></url>`);
    expect(xml).toContain(`<url><loc>${SITE}/routine/eee</loc></url>`);
    expect(xml).toContain(`<url><loc>${SITE}/routine/eee/teachers</loc></url>`);
    expect(xml).toContain(`<url><loc>${SITE}/routine/eee/1-2_B</loc></url>`);
    expect(xml).toContain(
      `<url><loc>${SITE}/routine/eee/teachers/ShA</loc></url>`,
    );
    expect(xml).toContain(`<url><loc>${SITE}/questions</loc></url>`);
    expect(xml).toContain(`<url><loc>${SITE}/contact</loc></url>`);
    expect(xml).toContain(`<url><loc>${SITE}/diuqbank</loc></url>`);
    expect(xml).toContain(`<url><loc>${SITE}/admission</loc></url>`);
    expect(xml).toContain(`<url><loc>${SITE}/privacy</loc></url>`);
    expect(xml).toContain(
      `<url><loc>${SITE}/questions/departments/3</loc></url>`,
    );
    expect(xml).toContain(`<url><loc>${SITE}/questions/courses/12</loc></url>`);
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

describe("canonicalUrl", () => {
  it("drops filters, sorting and tracking but keeps later pages", () => {
    expect(canonicalUrl(SITE, "/questions/courses/4", "?examTypeId=2")).toBe(
      `${SITE}/questions/courses/4`,
    );
    expect(
      canonicalUrl(
        SITE,
        "/questions/browse",
        "?departmentId=1&page=3&fbclid=x",
      ),
    ).toBe(`${SITE}/questions/browse?page=3`);
    expect(canonicalUrl(SITE, "/questions/contributors", "?page=1")).toBe(
      `${SITE}/questions/contributors`,
    );
  });
});

describe("breadcrumbJsonLd", () => {
  it("lists the trail with absolute URLs", () => {
    const ld = breadcrumbJsonLd(SITE, [
      { name: "DIU Question Bank", path: "/questions" },
      { name: "CSE", path: "/questions/departments/1" },
    ])["script:ld+json"];
    expect(ld["@type"]).toBe("BreadcrumbList");
    expect(ld.itemListElement[1]).toEqual({
      "@type": "ListItem",
      position: 2,
      name: "CSE",
      item: `${SITE}/questions/departments/1`,
    });
  });
});

describe("originOf", () => {
  it("reads the root loader's origin", () => {
    expect(originOf([{ id: "root", loaderData: { origin: SITE } }])).toBe(SITE);
    expect(originOf([undefined])).toBe("");
  });
});

describe("llmsTxt", () => {
  it("describes the site with live numbers, departments, courses and the move", () => {
    const txt = llmsTxt(
      SITE,
      {
        departments: [
          {
            id: 1,
            name: "Computer Science and Engineering",
            shortName: "CSE",
            publishedCount: 1200,
          },
          { id: 2, name: "Empty", shortName: "EM", publishedCount: 0 },
        ],
        courses: [
          {
            id: 9,
            name: "Data Structure",
            departmentId: 1,
            publishedCount: 40,
          },
          { id: 10, name: "Nothing yet", departmentId: 1, publishedCount: 0 },
        ],
      },
      {
        path: "/diuqbank",
        date: "1 October 2026",
        faq: [{ question: "Why?", answer: "Because." }],
      },
    );
    expect(txt).toMatch(/^# OurDIU\n\n> /);
    expect(txt).toContain("1,200 past exam question papers");
    expect(txt).toContain("from 1 courses in 1 departments");
    expect(txt).toContain(
      `- [DIU CSE Question Bank](${SITE}/questions/departments/1): Computer Science and Engineering, 1,200 papers`,
    );
    expect(txt).toContain(
      `- [Data Structure (CSE)](${SITE}/questions/courses/9): 40 papers`,
    );
    expect(txt).not.toContain("Empty");
    expect(txt).not.toContain("Nothing yet");
    expect(txt).toContain("### Why?\n\nBecause.");
    expect(txt).toContain(`(${SITE}/diuqbank)`);
    // Without a live routine, it's still coming.
    expect(txt).toContain(
      "A class routine and a student marketplace are coming.",
    );
  });

  it("lists the live class routines", () => {
    const txt = llmsTxt(
      SITE,
      { departments: [], courses: [] },
      { path: "/diuqbank", date: "1 October 2026", faq: [] },
      [{ department: "cse", sections: ["67_B", "67_C"], teachers: ["STA"] }],
    );
    expect(txt).toContain("and the Class Routine");
    expect(txt).toContain(`- The Class Routine is at ${SITE}/routine:`);
    expect(txt).toContain(
      `- [DIU CSE class routine](${SITE}/routine/cse): 2 sections, by batch or level and term`,
    );
    expect(txt).toContain(
      `- [DIU CSE teachers' routines](${SITE}/routine/cse/teachers): 1 teacher, by initials or name`,
    );
    expect(txt).not.toContain("A class routine and");
  });
});
