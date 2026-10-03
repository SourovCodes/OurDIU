import type { Sitemap } from "@ourdiu/shared";
import type { MetaDescriptor } from "react-router";
import { LEGAL_PAGES } from "./legal";
import { HUB_LIVE } from "./products";

/** The site's name in search results and link previews. */
export const SITE_NAME = "OurDIU";

/**
 * What students search for (docs/PLAN.md, decision 18): "diu question bank" brought
 * most of diuqbank.com's visitors, so the question bank's pages carry these words.
 */
export const QB_NAME = "DIU Question Bank";

/** The link preview image (1200×630), drawn by `tool/og-image.mjs`. */
export const OG_IMAGE = "/og.png";

/**
 * A page's title and description, also as its link preview (Open Graph, X), for
 * the Facebook groups and chats where students share links. The canonical URL,
 * og:url and the image come from the root (`SeoLinks`).
 */
export function pageMeta({
  title,
  description,
}: {
  title: string;
  description: string;
}): MetaDescriptor[] {
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
  ];
}

/** Query parameters that make a different page rather than a different view of it. */
const CANONICAL_PARAMS = ["page"];

/**
 * A page's canonical URL: filters, sorting and tracking parameters lead back to
 * the page itself; only pagination stays, and only past the first page.
 */
export function canonicalUrl(origin: string, pathname: string, search = "") {
  const kept = new URLSearchParams();
  const params = new URLSearchParams(search);
  for (const key of CANONICAL_PARAMS) {
    const value = params.get(key);
    if (value && !(key === "page" && value === "1")) kept.set(key, value);
  }
  const query = kept.toString();
  return `${origin}${pathname}${query ? `?${query}` : ""}`;
}

export type TrailStep = { name: string; path: string };

/** schema.org BreadcrumbList for a page's trail, shown in search results. */
export function breadcrumbJsonLd(origin: string, crumbs: TrailStep[]) {
  return {
    "script:ld+json": {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((crumb, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: crumb.name,
        item: origin + crumb.path,
      })),
    },
  } satisfies MetaDescriptor;
}

/**
 * schema.org WebSite for the hub (for /questions while the hub redirects there,
 * `HUB_LIVE`): the name search results show, and the names the site went by, so the
 * question bank's old searches find it.
 */
export function websiteJsonLd(
  origin: string,
  author: { name: string; links: readonly { href: string }[] },
) {
  return {
    "script:ld+json": {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      alternateName: ["Our DIU", QB_NAME, "DIU QBank", "diuqbank"],
      url: `${origin}/`,
      description:
        "Free tools for Daffodil International University (DIU) students, starting with the DIU Question Bank of past exam papers.",
      inLanguage: "en",
      publisher: {
        "@type": "Person",
        name: author.name,
        url: `${origin}/about`,
        sameAs: author.links.map((link) => link.href),
      },
    },
  } satisfies MetaDescriptor;
}

/** Public pages that always exist, with no data behind them. */
const STATIC_PATHS = [
  // Left out while it redirects to /questions.
  ...(HUB_LIVE ? ["/"] : []),
  "/questions",
  "/questions/browse",
  "/questions/departments",
  "/diuqbank",
  "/admission",
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
export function sitemapXml(
  origin: string,
  sitemap: Sitemap,
  /** Departments and courses with papers to read, from the taxonomy. */
  {
    departmentIds = [],
    courseIds = [],
  }: {
    departmentIds?: number[];
    courseIds?: number[];
  } = {},
) {
  const entries = [
    ...STATIC_PATHS.map((path) => urlEntry(origin + path)),
    ...departmentIds.map((id) =>
      urlEntry(`${origin}/questions/departments/${id}`),
    ),
    ...courseIds.map((id) => urlEntry(`${origin}/questions/courses/${id}`)),
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

/** The site's origin in a route's `meta`, from the root loader. */
export function originOf(
  matches: readonly ({ id: string; loaderData?: unknown } | undefined)[],
) {
  const root = matches.find((match) => match?.id === "root")?.loaderData as
    { origin?: string } | undefined;
  return root?.origin ?? "";
}

type Counted = { id: number; name: string; publishedCount: number };

/**
 * /llms.txt (llmstxt.org): the site in Markdown for AI assistants and answer
 * engines, with live numbers, so they describe and link it correctly.
 */
export function llmsTxt(
  origin: string,
  {
    departments,
    courses,
  }: {
    departments: (Counted & { shortName: string })[];
    courses: (Counted & { departmentId: number })[];
  },
  move: {
    path: string;
    date: string;
    faq: readonly { question: string; answer: string }[];
  },
) {
  const withPapers = <T extends Counted>(items: T[]) =>
    items
      .filter((item) => item.publishedCount > 0)
      .sort((a, b) => b.publishedCount - a.publishedCount);
  const shownDepartments = withPapers(departments);
  const shownCourses = withPapers(courses);
  const papers = shownDepartments.reduce((sum, d) => sum + d.publishedCount, 0);
  const shortName = new Map(departments.map((d) => [d.id, d.shortName]));
  const count = (n: number) =>
    `${n.toLocaleString("en-US")} paper${n === 1 ? "" : "s"}`;

  return [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_NAME} (ourdiu.com) is a free website and Android app for students of Daffodil International University (DIU), Bangladesh. Its first part is the ${QB_NAME}: ${papers.toLocaleString("en-US")} past exam question papers (finals, midterms and quizzes) from ${shownCourses.length} courses in ${shownDepartments.length} departments, shared by students. Until ${move.date} it was DIU QBank at diuqbank.com.`,
    "",
    `- The ${QB_NAME} is at ${origin}/questions. Papers are free to read and download, with no ads and no sign-up to read.`,
    `- diuqbank.com moved to ourdiu.com on ${move.date}; its pages redirect to the same pages here (diuqbank.com/questions/123 is ${origin}/questions/123).`,
    `- Each course has a page listing its papers by semester and exam type, and each exam has a page with its question papers (PDF).`,
    "- A class routine and a student marketplace are coming.",
    "",
    `## ${QB_NAME}`,
    "",
    `- [${QB_NAME}](${origin}/questions): search a course, see the papers most viewed today and the newest`,
    `- [All papers](${origin}/questions/browse): every paper, filterable by department, course, semester and exam type`,
    `- [Departments](${origin}/questions/departments): each department's courses`,
    `- [Contributors](${origin}/questions/contributors): the students who share papers`,
    `- [DIU QBank moved to OurDIU](${origin}${move.path}): what changed on ${move.date}, and why`,
    "",
    "## Departments",
    "",
    ...shownDepartments.map(
      (d) =>
        `- [DIU ${d.shortName} Question Bank](${origin}/questions/departments/${d.id}): ${d.name}, ${count(d.publishedCount)}`,
    ),
    "",
    "## Courses with the most papers",
    "",
    ...shownCourses
      .slice(0, 30)
      .map(
        (c) =>
          `- [${c.name} (${shortName.get(c.departmentId) ?? "DIU"})](${origin}/questions/courses/${c.id}): ${count(c.publishedCount)}`,
      ),
    "",
    "## Questions about the move",
    "",
    ...move.faq.flatMap(({ question, answer }) => [
      `### ${question}`,
      "",
      answer,
      "",
    ]),
    "## Optional",
    "",
    `- [About](${origin}/about): who builds ${SITE_NAME}, and why it stays free`,
    `- [Contact](${origin}/contact): bugs, ideas, removing a paper`,
    `- [Android app](${origin}/app)`,
    `- [Copyright and removal](${origin}/copyright)`,
    `- [Privacy](${origin}/privacy) · [Terms](${origin}/terms)`,
    "",
  ].join("\n");
}
