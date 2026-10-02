/**
 * The OurDIU Android app. While it's in Google Play's closed testing, the site
 * recruits testers: Play needs 12 who stay opted in for 14 days before the app
 * can go to production. Testers join the Google Group, which is the closed
 * track's tester list, then opt in on Play.
 *
 * Set ANDROID_BETA to false once the app is public: the banner and the account
 * page's link disappear, and /app becomes a plain "Get it on Google Play" page.
 */
export const ANDROID_BETA = true;

export const TESTER_GROUP_URL = "https://groups.google.com/g/ourdiu";
export const PLAY_TESTING_URL =
  "https://play.google.com/apps/testing/com.ourdiu.app";
export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.ourdiu.app";

export const ANDROID_PACKAGE = "com.ourdiu.app";

/**
 * SHA-256 of the key Google Play signs the app with (Play App Signing: Play
 * Console → App integrity → App signing, "App signing key certificate"; not
 * the upload key). Android checks it against `/.well-known/assetlinks.json`
 * before letting the app open ourdiu.com links.
 */
export const ANDROID_SIGNING_SHA256 =
  "86:51:83:0A:15:06:D3:72:70:63:2D:BE:A3:19:46:0C:58:C0:F2:CD:33:4C:61:C6:09:13:1D:79:86:26:45:C4";

/** Digital Asset Links: the app may open this site's links (Android App Links). */
export function assetLinks() {
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: ANDROID_PACKAGE,
        sha256_cert_fingerprints: [ANDROID_SIGNING_SHA256],
      },
    },
  ];
}

export function isAndroid(userAgent: string) {
  return /\bAndroid\b/i.test(userAgent);
}

/**
 * Set when the visitor closes the invitation. A cookie rather than browser
 * storage, so the server knows too and the page never shifts when it hides.
 */
export const DISMISSED_COOKIE = "ourdiu_android_invite";
const DISMISS_FOR_SECONDS = 30 * 24 * 60 * 60;

/** Whether a Cookie header (or `document.cookie`) says the invitation was closed. */
export function inviteDismissed(cookie: string | null | undefined) {
  return new RegExp(`(?:^|;\\s*)${DISMISSED_COOKIE}=`).test(cookie ?? "");
}

/** Hides the invitation for 30 days. */
export function dismissBanner() {
  document.cookie = `${DISMISSED_COOKIE}=dismissed; Max-Age=${DISMISS_FOR_SECONDS}; Path=/; SameSite=Lax`;
}

/** What the server tells the page about the invitation, before it renders. */
export type AndroidInvite = { android: boolean; dismissed: boolean };

export function androidInvite(request: Request): AndroidInvite {
  return {
    android: isAndroid(request.headers.get("user-agent") ?? ""),
    dismissed: inviteDismissed(request.headers.get("cookie")),
  };
}

const DOWNLOAD_INVITE_KEY = "ourdiu.androidBetaDownloadInvite";

/**
 * True the first time it's called in a browser session: the download invitation
 * shows once per visit, not on every paper.
 */
export function takeDownloadInvite() {
  try {
    if (sessionStorage.getItem(DOWNLOAD_INVITE_KEY)) return false;
    sessionStorage.setItem(DOWNLOAD_INVITE_KEY, "1");
    return true;
  } catch {
    return false;
  }
}
