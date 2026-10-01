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

export function isAndroid(userAgent: string) {
  return /\bAndroid\b/i.test(userAgent);
}

const DISMISSED_KEY = "ourdiu.androidBetaDismissedAt";
const DISMISS_FOR_MS = 30 * 24 * 60 * 60 * 1000;

/** Whether the visitor closed the beta banner in the last 30 days. */
export function bannerDismissed(now = Date.now()) {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY));
    return at > 0 && now - at < DISMISS_FOR_MS;
  } catch {
    return false;
  }
}

export function dismissBanner(now = Date.now()) {
  try {
    localStorage.setItem(DISMISSED_KEY, String(now));
  } catch {
    // Private mode or blocked storage: it just shows again next visit.
  }
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
