// Renders the link preview image (Open Graph, 1200×630) to public/og.png with
// Playwright: the app's mark (as in apps/mobile/tool/brand/render.mjs) and the
// words students search for. Run from the repo root: node apps/web/tool/og-image.mjs
/* global URL, document, console */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../package.json", import.meta.url));
const { chromium } = require("@playwright/test");

const INDIGO = "#4F39F6";
const LAVENDER = "#C5BFFF";
const WHITE = "#FFFFFF";

/** The scalloped "cookie" of the design system, centred in a box. */
function cookie(box, radius) {
  const c = box / 2;
  const points = [];
  for (let i = 0; i <= 360; i++) {
    const t = (i / 360) * Math.PI * 2;
    const r = radius * (0.88 + 0.1 * Math.cos(9 * t));
    points.push(
      `${i ? "L" : "M"}${(c + Math.cos(t) * r).toFixed(2)} ${(c + Math.sin(t) * r).toFixed(2)}`,
    );
  }
  return `${points.join(" ")}Z`;
}

/** Lucide's graduation-cap, centred in the box. */
function cap(box, width, color) {
  const scale = width / 22;
  const x = box / 2 - 12 * scale;
  const y = box / 2 - 11.3 * scale;
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="${color}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>
    <path d="M22 10v6"/>
    <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>
  </g>`;
}

const MARK = 260;
const mark = `<svg xmlns="http://www.w3.org/2000/svg" width="${MARK}" height="${MARK}" viewBox="0 0 ${MARK} ${MARK}">
  <path d="${cookie(MARK, 125)}" fill="${WHITE}"/>${cap(MARK, 125 * 1.05, INDIGO)}</svg>`;

const font = readFileSync(
  fileURLToPath(
    new URL(
      "../node_modules/@fontsource-variable/roboto-flex/files/roboto-flex-latin-standard-normal.woff2",
      import.meta.url,
    ),
  ),
).toString("base64");

const html = `<!doctype html><html><head><style>
  @font-face { font-family: "Roboto Flex"; src: url(data:font/woff2;base64,${font}) format("woff2"); font-weight: 100 1000; font-stretch: 25% 151%; }
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: ${INDIGO}; color: ${WHITE}; font-family: "Roboto Flex"; display: flex; align-items: center; gap: 64px; padding: 0 88px; }
  .eyebrow { font-size: 34px; font-weight: 600; color: ${LAVENDER}; letter-spacing: 0.5px; }
  h1 { font-size: 104px; line-height: 0.98; font-weight: 800; font-stretch: 130%; margin: 14px 0 26px; }
  p { font-size: 32px; line-height: 1.3; color: ${LAVENDER}; max-width: 680px; }
  .site { margin-top: 34px; font-size: 30px; font-weight: 700; }
</style></head><body>
  ${mark}
  <div>
    <div class="eyebrow">OurDIU</div>
    <h1>DIU Question Bank</h1>
    <p>Past exam papers of Daffodil International University. Free, no ads.</p>
    <div class="site">ourdiu.com/questions</div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
const out = fileURLToPath(new URL("../public/og.png", import.meta.url));
await page.screenshot({ path: out });
await browser.close();
console.log(`Wrote ${out}`);
