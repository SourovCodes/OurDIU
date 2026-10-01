import { cleanup, render, screen } from "@testing-library/react";
import { createRoutesStub, Outlet } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Toaster } from "~/components/ui/sonner";
import { androidInvite, DISMISSED_COOKIE } from "~/lib/android-app";
import {
  AndroidBetaBanner,
  AndroidBetaLink,
  AndroidBetaStrip,
  useDownloadInvite,
} from "./android-beta";

const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

/** Renders under a root route that decides like the real one, from the request. */
function renderOn(
  userAgent: string,
  Component: () => React.ReactNode = AndroidBetaBanner,
  path = "/",
) {
  const request = new Request("http://localhost/", {
    headers: { "user-agent": userAgent, cookie: document.cookie },
  });
  const Stub = createRoutesStub([
    {
      id: "root",
      loader: () => ({ androidInvite: androidInvite(request) }),
      Component: () => <Outlet />,
      children: [{ path: "*", Component }],
      HydrateFallback: () => null,
    },
  ]);
  render(<Stub initialEntries={[path]} />);
}

/** Long enough for anything that would appear after hydration to appear. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
  document.cookie = `${DISMISSED_COOKIE}=; Max-Age=0; Path=/`;
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("invites Android visitors to become testers", async () => {
  renderOn(ANDROID);
  expect(
    await screen.findByRole("link", { name: "Become a tester" }),
  ).toHaveProperty("pathname", "/app");
});

it("stays away from other devices", async () => {
  renderOn(IPHONE);
  await settle();
  expect(screen.queryByText("Try the OurDIU Android app early")).toBeNull();
});

it("stays dismissed for 30 days", async () => {
  const set = vi.spyOn(document, "cookie", "set");
  renderOn(ANDROID);
  (await screen.findByRole("button", { name: "Dismiss" })).click();
  await vi.waitFor(() =>
    expect(screen.queryByText("Try the OurDIU Android app early")).toBeNull(),
  );
  expect(set).toHaveBeenCalledWith(
    expect.stringMatching(/^ourdiu_android_invite=dismissed; Max-Age=2592000;/),
  );
  set.mockRestore();

  cleanup();
  renderOn(ANDROID);
  await settle();
  expect(screen.queryByText("Try the OurDIU Android app early")).toBeNull();
});

it("links signed-in Android visitors from the account page", async () => {
  renderOn(ANDROID, () => <AndroidBetaLink />);
  expect(
    await screen.findByRole("link", { name: "Become a tester" }),
  ).toHaveProperty("pathname", "/app");
});

it("shows the strip on Question Bank pages, not your papers", async () => {
  renderOn(ANDROID, AndroidBetaStrip, "/questions/42");
  expect(
    await screen.findByRole("link", { name: "become a tester" }),
  ).toHaveProperty("pathname", "/app");

  for (const path of ["/questions/my-submissions", "/about"]) {
    cleanup();
    renderOn(ANDROID, AndroidBetaStrip, path);
    await settle();
    expect(screen.queryByRole("complementary")).toBeNull();
  }
});

it("closing the strip hides the banner too", async () => {
  renderOn(ANDROID, AndroidBetaStrip, "/questions/42");
  (await screen.findByRole("button", { name: "Dismiss" })).click();
  await vi.waitFor(() =>
    expect(screen.queryByRole("complementary")).toBeNull(),
  );

  cleanup();
  renderOn(ANDROID);
  await settle();
  expect(screen.queryByText("Try the OurDIU Android app early")).toBeNull();
});

function DownloadButton() {
  const invite = useDownloadInvite();
  return (
    <>
      <button onClick={invite}>Download</button>
      <Toaster />
    </>
  );
}

it("invites Android readers to the app on their first download of a visit", async () => {
  renderOn(ANDROID, DownloadButton);
  const download = await screen.findByRole("button", { name: "Download" });
  download.click();
  expect(
    await screen.findByText("Read papers offline in the OurDIU app"),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Become a tester" })).toBeTruthy();

  // A second download in the same visit adds no second invitation.
  download.click();
  await settle();
  expect(
    screen.getAllByText("Read papers offline in the OurDIU app"),
  ).toHaveLength(1);
});
