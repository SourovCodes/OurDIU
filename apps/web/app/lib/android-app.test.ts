import { describe, expect, it } from "vitest";
import {
  ANDROID_SCRIPT,
  APP_DECLINES_COOKIE,
  APP_SHEET_COOKIE,
  appDeclines,
  appPathFor,
  declinedApp,
  installSource,
  offersAppSheet,
  playStoreUrl,
  showsAppBanner,
} from "./android-app";

const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
const GOOGLEBOT =
  "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

describe("offersAppSheet", () => {
  it("asks Android visitors who haven't answered", () => {
    expect(offersAppSheet(ANDROID, "", "/questions/5")).toBe(true);
    expect(offersAppSheet(ANDROID, "ourdiu_space=routine", "/routine")).toBe(
      true,
    );
  });

  it("leaves out answered visitors, other phones, crawlers and some pages", () => {
    expect(offersAppSheet(ANDROID, `${APP_SHEET_COOKIE}=1`, "/")).toBe(false);
    expect(offersAppSheet(IPHONE, "", "/")).toBe(false);
    expect(offersAppSheet(GOOGLEBOT, "", "/")).toBe(false);
    for (const path of ["/app", "/login", "/admin", "/admin/questions"]) {
      expect(offersAppSheet(ANDROID, "", path)).toBe(false);
    }
    expect(offersAppSheet(ANDROID, "", "/apply")).toBe(true);
  });
});

describe("ANDROID_SCRIPT", () => {
  const marks = (userAgent: string) => {
    const root = { dataset: {} as Record<string, string> };
    new Function("navigator", "document", ANDROID_SCRIPT)(
      { userAgent },
      { documentElement: root },
    );
    return "android" in root.dataset;
  };

  it("marks Android browsers, not crawlers or iPhones", () => {
    expect(marks(ANDROID)).toBe(true);
    expect(marks(GOOGLEBOT)).toBe(false);
    expect(marks(IPHONE)).toBe(false);
  });
});

describe("showsAppBanner", () => {
  it("leaves out the app's page, signing in and admin", () => {
    expect(showsAppBanner("/questions/1")).toBe(true);
    expect(showsAppBanner("/")).toBe(true);
    expect(showsAppBanner("/app")).toBe(false);
    expect(showsAppBanner("/login")).toBe(false);
    expect(showsAppBanner("/admin/submissions")).toBe(false);
  });
});

describe("declinedApp", () => {
  it("stops asking after two no's to the app", () => {
    expect(appDeclines("")).toBe(0);
    expect(appDeclines(`a=b; ${APP_DECLINES_COOKIE}=1`)).toBe(1);
    expect(declinedApp(`${APP_DECLINES_COOKIE}=1`)).toBe(false);
    expect(declinedApp(`${APP_DECLINES_COOKIE}=2`)).toBe(true);
    expect(declinedApp(`x${APP_DECLINES_COOKIE}=5`)).toBe(false);
    expect(offersAppSheet(ANDROID, `${APP_DECLINES_COOKIE}=2`, "/")).toBe(
      false,
    );
  });
});

describe("appPathFor", () => {
  it("opens the same page for the question bank, else its home", () => {
    expect(appPathFor("/questions/5", "?submission=7")).toBe(
      "/questions/5?submission=7",
    );
    expect(appPathFor("/questions", "")).toBe("/questions");
    expect(appPathFor("/routine/cse/67_B", "")).toBe("/questions");
    expect(appPathFor("/questionsx", "")).toBe("/questions");
  });
});

describe("playStoreUrl", () => {
  it("tags the Google Play link with where the install came from", () => {
    const url = new URL(
      playStoreUrl({ utm_source: "ourdiu.com", utm_medium: "app_page" }),
    );
    expect(url.searchParams.get("id")).toBe("com.ourdiu.app");
    expect(url.searchParams.get("referrer")).toBe(
      "utm_source=ourdiu.com&utm_medium=app_page",
    );
  });
});

describe("installSource", () => {
  it("is the site and the place on it, without utm_ parameters", () => {
    expect(installSource("", "app_page")).toEqual({
      utm_source: "ourdiu.com",
      utm_medium: "app_page",
    });
  });

  it("passes on a post's or an ad's own utm_ parameters", () => {
    expect(
      installSource(
        "?utm_source=facebook&utm_medium=group&utm_campaign=finals",
        "app_page",
      ),
    ).toEqual({
      utm_source: "facebook",
      utm_medium: "group",
      utm_campaign: "finals",
    });
    expect(installSource("?utm_source=cse_group", "app_page")).toEqual({
      utm_source: "cse_group",
      utm_medium: "referral",
      utm_campaign: undefined,
    });
  });
});
