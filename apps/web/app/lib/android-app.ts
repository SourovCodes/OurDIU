/** The OurDIU Android app, on Google Play since October 2026. */
export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.ourdiu.app";

export const ANDROID_PACKAGE = "com.ourdiu.app";

/** Where an install came from, as Play Console and Firebase report it. */
export type InstallSource = {
  utm_source: string;
  utm_medium: string;
  utm_campaign?: string;
};

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;

/**
 * Google Play's page for the app, tagged with where the visitor came from: Play
 * hands the `referrer` to the app on install, so Play Console's acquisition
 * reports and Firebase's first_open show the source (docs/PLAN.md, decision 67).
 */
export function playStoreUrl(source: InstallSource) {
  const referrer = UTM_KEYS.filter((key) => source[key])
    .map((key) => `${key}=${encodeURIComponent(source[key]!)}`)
    .join("&");
  return `${PLAY_STORE_URL}&referrer=${encodeURIComponent(referrer)}`;
}

/**
 * The source for links on a page: the page's own utm_ parameters when a post or
 * ad linked to it with them (ourdiu.com/app?utm_source=facebook), else the site
 * and `medium`, the place on the site.
 */
export function installSource(search: string, medium: string): InstallSource {
  const params = new URLSearchParams(search);
  const source = params.get("utm_source")?.slice(0, 100);
  if (!source) return { utm_source: "ourdiu.com", utm_medium: medium };
  return {
    utm_source: source,
    utm_medium: params.get("utm_medium")?.slice(0, 100) || "referral",
    utm_campaign: params.get("utm_campaign")?.slice(0, 100) || undefined,
  };
}

/**
 * SHA-256 fingerprints of the keys Google Play signs the app with, as Play
 * Console lists them (Grow users → Deep links → Add domain): the app signing
 * key (Play App Signing; not our upload key) first, then two more keys Google
 * holds for the app. Android checks them against `/.well-known/assetlinks.json`
 * before letting the app open ourdiu.com links.
 */
export const ANDROID_SIGNING_SHA256 = [
  "86:51:83:0A:15:06:D3:72:70:63:2D:BE:A3:19:46:0C:58:C0:F2:CD:33:4C:61:C6:09:13:1D:79:86:26:45:C4",
  "00:CC:95:DE:2F:4F:65:70:0F:97:1C:F6:2A:8B:2F:CF:01:54:8A:DE:2B:98:79:FB:CC:70:0F:F6:CB:1A:B5:69",
  "C4:44:42:E3:A6:55:08:78:F0:B1:8F:36:F6:97:6A:59:3E:34:D2:10:F8:56:7C:F4:7C:67:DD:EF:A5:E3:C6:48",
];

/** Digital Asset Links: the app may open this site's links (Android App Links). */
export function assetLinks() {
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: ANDROID_PACKAGE,
        sha256_cert_fingerprints: ANDROID_SIGNING_SHA256,
      },
    },
  ];
}

export function isAndroid(userAgent: string) {
  return /\bAndroid\b/i.test(userAgent);
}

/**
 * A link that opens one of the site's pages in the app (it handles ourdiu.com's
 * /questions links, decision 13), or Google Play's page for it when the app isn't
 * installed. An Android intent URL, so it works in Chrome even on the page the app
 * would open: a plain link to the same page stays in the browser. `medium` tags
 * the Google Play link with the place on the site that offered the app.
 */
export function openInAppUrl(path: string, medium: string) {
  const fallback = encodeURIComponent(
    playStoreUrl({ utm_source: "ourdiu.com", utm_medium: medium }),
  );
  return `intent://ourdiu.com${path}#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`;
}

/** Set once an Android visitor answers the "Open in the app" sheet, either way. */
export const APP_SHEET_COOKIE = "ourdiu_app_sheet";
// For good: 400 days is the longest a browser keeps a cookie.
const APP_SHEET_FOR_SECONDS = 400 * 24 * 60 * 60;

/**
 * How many times an Android visitor chose the browser over the app ("Continue in
 * browser" on the sheet, "Open the PDF" or "Download" on a paper's card). After
 * `APP_DECLINE_LIMIT` the site stops asking (docs/PLAN.md, decision 65).
 */
export const APP_DECLINES_COOKIE = "ourdiu_app_declines";
export const APP_DECLINE_LIMIT = 2;

export function appDeclines(cookie: string) {
  const match = cookie.match(
    new RegExp(`(?:^|;\\s*)${APP_DECLINES_COOKIE}=(\\d+)`),
  );
  return match ? Number(match[1]) : 0;
}

/** Whether the visitor has said no to the app often enough not to be asked again. */
export function declinedApp(cookie: string) {
  return appDeclines(cookie) >= APP_DECLINE_LIMIT;
}

/** Counts one more "no" to the app. */
export function declineApp() {
  const count = appDeclines(document.cookie) + 1;
  document.cookie = `${APP_DECLINES_COOKIE}=${count}; Max-Age=${APP_SHEET_FOR_SECONDS}; Path=/; SameSite=Lax`;
}

/** Pages without the sheet: the app's own page, signing in and admin. */
const NO_SHEET = /^\/(app|login|admin)(\/|$)/;

/** Crawlers and test tools that say Android: Google's smartphone crawler, Lighthouse. */
const ROBOT = /bot|crawl|spider|lighthouse|headless/i;

/**
 * Whether to ask this visitor, once, to use the app (docs/PLAN.md, decision 55):
 * Android browsers that haven't answered yet, on pages where it makes sense.
 */
export function offersAppSheet(
  userAgent: string,
  cookie: string,
  pathname: string,
) {
  return (
    isAndroid(userAgent) &&
    !ROBOT.test(userAgent) &&
    !new RegExp(`(?:^|;\\s*)${APP_SHEET_COOKIE}=`).test(cookie) &&
    !declinedApp(cookie) &&
    !NO_SHEET.test(pathname)
  );
}

/** Keeps the sheet away for good. */
export function dismissAppSheet() {
  document.cookie = `${APP_SHEET_COOKIE}=1; Max-Age=${APP_SHEET_FOR_SECONDS}; Path=/; SameSite=Lax`;
}

/**
 * Where "Open in the app" lands: the same page for the question bank's pages (the
 * app's links), else the app's Question Bank home (`/questions`), since Chrome only
 * opens an app for a link it handles.
 */
export function appPathFor(pathname: string, search: string) {
  return /^\/questions(\/|$)/.test(pathname) ? pathname + search : "/questions";
}
