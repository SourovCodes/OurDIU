import { cleanup, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AndroidBetaBanner, AndroidBetaLink } from "./android-beta";

const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

function renderOn(userAgent: string, Component = AndroidBetaBanner) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
  const Stub = createRoutesStub([{ path: "/", Component }]);
  render(<Stub initialEntries={["/"]} />);
}

beforeEach(() => localStorage.clear());
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
  // Long enough for the effect that decides to run.
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(screen.queryByText("Try the OurDIU Android app early")).toBeNull();
});

it("stays dismissed for 30 days", async () => {
  renderOn(ANDROID);
  (await screen.findByRole("button", { name: "Dismiss" })).click();
  await vi.waitFor(() =>
    expect(screen.queryByText("Try the OurDIU Android app early")).toBeNull(),
  );

  cleanup();
  renderOn(ANDROID);
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(screen.queryByText("Try the OurDIU Android app early")).toBeNull();

  cleanup();
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 31 * 24 * 60 * 60 * 1000);
  renderOn(ANDROID);
  expect(
    await screen.findByText("Try the OurDIU Android app early"),
  ).toBeTruthy();
});

it("links signed-in Android visitors from the account page", async () => {
  renderOn(ANDROID, AndroidBetaLink);
  expect(
    await screen.findByRole("link", { name: "Become a tester" }),
  ).toHaveProperty("pathname", "/app");
});
