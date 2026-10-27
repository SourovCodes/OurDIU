import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  APP_DECLINES_COOKIE,
  APP_SHEET_COOKIE,
  openInAppUrl,
} from "~/lib/android-app";
import { AppSheet } from "./app-sheet";

const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";

const gtag = vi.fn();

beforeEach(() => {
  vi.stubGlobal("navigator", { ...navigator, userAgent: ANDROID });
  vi.stubGlobal("gtag", gtag);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  gtag.mockReset();
  document.cookie = `${APP_SHEET_COOKIE}=; Max-Age=0; Path=/`;
  document.cookie = `${APP_DECLINES_COOKIE}=; Max-Age=0; Path=/`;
});

function renderAt(path: string) {
  const Stub = createRoutesStub([{ path: "*", Component: AppSheet }]);
  render(<Stub initialEntries={[path]} />);
}

it("asks once, opening the same page in the app", async () => {
  renderAt("/questions/5?submission=7");
  const open = await screen.findByRole("link", { name: "Open in the app" });
  expect(open.getAttribute("href")).toBe(
    openInAppUrl("/questions/5?submission=7"),
  );
  expect(gtag).toHaveBeenCalledWith("event", "app_sheet_shown");

  fireEvent.click(screen.getByRole("button", { name: "Continue in browser" }));
  expect(gtag).toHaveBeenCalledWith("event", "app_sheet_browser");
  expect(document.cookie).toContain(`${APP_SHEET_COOKIE}=1`);
  // Choosing the browser is one "no" to the app.
  expect(document.cookie).toContain(`${APP_DECLINES_COOKIE}=1`);

  // Answered: not asked again.
  cleanup();
  renderAt("/questions");
  expect(screen.queryByTestId("open-in-app-sheet")).toBeNull();
});

it("opens the app's home from other pages, and counts the tap", async () => {
  renderAt("/routine/cse/67_B");
  const open = await screen.findByRole("link", { name: "Open in the app" });
  expect(open.getAttribute("href")).toBe(openInAppUrl("/questions"));
  open.addEventListener("click", (event) => event.preventDefault());
  fireEvent.click(open);
  expect(gtag).toHaveBeenCalledWith("event", "app_sheet_open");
  expect(document.cookie).toContain(`${APP_SHEET_COOKIE}=1`);
  expect(document.cookie).not.toContain(APP_DECLINES_COOKIE);
});
