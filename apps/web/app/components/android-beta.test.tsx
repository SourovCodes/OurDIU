import { cleanup, render, screen } from "@testing-library/react";
import { createRoutesStub, Outlet } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Toaster } from "~/components/ui/sonner";
import { androidInvite, DISMISSED_COOKIE } from "~/lib/android-app";
import {
  AndroidBetaLink,
  AndroidBetaStrip,
  useDownloadInvite,
} from "./android-beta";

const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

/** Renders under a root route that decides like the real one, from the request. */
function renderOn(
  userAgent: string,
  Component: () => React.ReactNode = AndroidBetaStrip,
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

it("invites every visitor, on every page but the app's own", async () => {
  for (const userAgent of [ANDROID, IPHONE, DESKTOP]) {
    for (const path of ["/", "/questions/42", "/about"]) {
      cleanup();
      renderOn(userAgent, AndroidBetaStrip, path);
      expect(
        await screen.findByRole("link", { name: "become a tester" }),
      ).toHaveProperty("pathname", "/app");
    }
  }

  cleanup();
  renderOn(DESKTOP, AndroidBetaStrip, "/app");
  await settle();
  expect(screen.queryByRole("complementary")).toBeNull();
});

it("stays closed once closed", async () => {
  const set = vi.spyOn(document, "cookie", "set");
  renderOn(DESKTOP, AndroidBetaStrip, "/questions/42");
  (await screen.findByRole("button", { name: "Dismiss" })).click();
  await vi.waitFor(() =>
    expect(screen.queryByRole("complementary")).toBeNull(),
  );
  expect(set).toHaveBeenCalledWith(
    expect.stringMatching(
      /^ourdiu_android_invite=dismissed; Max-Age=34560000;/,
    ),
  );
  set.mockRestore();

  cleanup();
  renderOn(DESKTOP, AndroidBetaStrip, "/");
  await settle();
  expect(screen.queryByRole("complementary")).toBeNull();
});

it("still links to the app from the account page after closing", async () => {
  document.cookie = `${DISMISSED_COOKIE}=dismissed; Path=/`;
  renderOn(DESKTOP, () => <AndroidBetaLink />);
  expect(
    await screen.findByRole("link", { name: "Become a tester" }),
  ).toHaveProperty("pathname", "/app");
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

it("keeps the download invitation to Android readers", async () => {
  renderOn(DESKTOP, DownloadButton);
  (await screen.findByRole("button", { name: "Download" })).click();
  await settle();
  // The once-a-visit invitation is still unused.
  expect(sessionStorage.length).toBe(0);
});
