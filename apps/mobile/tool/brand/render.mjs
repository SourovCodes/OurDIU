// Renders the OurDIU app icon and splash artwork to assets/brand/, with the web
// app's Playwright. Then `dart run flutter_launcher_icons` and
// `dart run flutter_native_splash:create` turn them into the platform files.
// Run from the repo root: node apps/mobile/tool/brand/render.mjs
//
// The mark: the scalloped "cookie" shape of the app's design system (Finals use it
// too) with the graduation cap of the website's OurDIU logo, in the app's indigo.
/* global URL, document */
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(
  new URL("../../../web/package.json", import.meta.url),
);
const { chromium } = require("@playwright/test");

const INDIGO = "#4F39F6";
const LAVENDER = "#C5BFFF"; // the indigo of the dark theme
const WHITE = "#FFFFFF";

/** The cookie, like `examPath` in lib/theme/exam_shape.dart, centred in a box. */
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

/** Lucide's graduation-cap (24×24, stroked), centred at the box's centre. */
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

/** A cookie of the given radius with the cap on it. */
function mark(box, radius, shape, glyph) {
  return `<path d="${cookie(box, radius)}" fill="${shape}"/>${cap(box, radius * 1.05, glyph)}`;
}

const svg = (box, body, background = "none") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}">
    <rect width="${box}" height="${box}" fill="${background}"/>${body}</svg>`;

// Android's themed (monochrome) icon: the cookie with the cap cut out of it.
const monochrome = (box, radius) => `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}">
  <mask id="m"><rect width="${box}" height="${box}" fill="black"/><path d="${cookie(box, radius)}" fill="white"/>${cap(box, radius * 1.05, "black")}</mask>
  <rect width="${box}" height="${box}" fill="${WHITE}" mask="url(#m)"/></svg>`;

// Inlined: a page made with setContent can't load file:// fonts.
const fontUrl = `data:font/ttf;base64,${readFileSync(
  new URL("../../assets/fonts/RobotoFlex.ttf", import.meta.url),
).toString("base64")}`;
const wordmark = (color) => `<!doctype html><html><head><style>
  @font-face { font-family: RobotoFlex; src: url("${fontUrl}"); }
  html, body { margin: 0; background: transparent; }
  div { width: 800px; height: 200px; display: flex; align-items: center; justify-content: center;
    font-family: RobotoFlex; font-size: 120px; color: ${color}; letter-spacing: -2px;
    font-variation-settings: "wdth" 130, "wght" 820, "opsz" 120; }
</style></head><body><div>OurDIU</div></body></html>`;

const out = (name) =>
  fileURLToPath(
    new URL(
      name.startsWith("store/") ? `../../${name}` : `../../assets/brand/${name}`,
      import.meta.url,
    ),
  );
mkdirSync(fileURLToPath(new URL("../../assets/brand/", import.meta.url)), {
  recursive: true,
});

const images = [
  // iOS and older Android: full bleed, no transparency.
  ["icon.png", 1024, svg(1024, mark(1024, 380, WHITE, INDIGO), INDIGO)],
  // Google Play's listing icon (uploaded by hand in Play Console).
  ["store/icon-512.png", 512, svg(512, mark(512, 190, WHITE, INDIGO), INDIGO)],
  // Android adaptive icon, on the indigo background colour
  // (flutter_launcher_icons.yaml), which insets it by 16% and masks it to a circle
  // or squircle: sized so the mark matches icon.png.
  ["icon_foreground.png", 1024, svg(1024, mark(1024, 360, WHITE, INDIGO))],
  ["icon_monochrome.png", 1024, monochrome(1024, 360)],
  // Splash screens: the mark on the theme's surface colour.
  ["splash.png", 768, svg(768, mark(768, 300, INDIGO, WHITE))],
  // Android 12+: a 960px icon inside a 640px circle.
  ["splash_android12.png", 960, svg(960, mark(960, 300, INDIGO, WHITE))],
];

const browser = await chromium.launch();
for (const [name, size, content] of images) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
  });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${content}</body></html>`,
  );
  await page.screenshot({ path: out(name), omitBackground: true });
  await page.close();
}
for (const [name, color] of [
  ["branding.png", INDIGO],
  ["branding_dark.png", LAVENDER],
]) {
  const page = await browser.newPage({ viewport: { width: 800, height: 200 } });
  await page.setContent(wordmark(color));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out(name), omitBackground: true });
  await page.close();
}
await browser.close();
