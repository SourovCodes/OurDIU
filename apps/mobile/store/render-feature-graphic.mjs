// Renders feature-graphic.html to feature-graphic.png with the web app's Playwright.
// Run from the repo root: node apps/mobile/store/render-feature-graphic.mjs
/* global URL, document */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../../web/package.json", import.meta.url));
const { chromium } = require("@playwright/test");

const html = new URL("./feature-graphic.html", import.meta.url);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 500 } });
await page.goto(html.href);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({
  path: fileURLToPath(new URL("./feature-graphic.png", import.meta.url)),
});
await browser.close();
