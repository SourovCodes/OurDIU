import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { openInAppUrl } from "~/lib/android-app";
import { PdfViewer } from "./pdf-viewer";

const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** A browser without a PDF viewer of its own, like most phones'. */
function phone(userAgent: string) {
  vi.stubGlobal("navigator", {
    ...navigator,
    userAgent,
    pdfViewerEnabled: false,
  });
}

const PAPER = "/questions/5?submission=7";

it("asks Android visitors to read a public paper in the app", () => {
  phone(ANDROID);
  render(<PdfViewer src="/paper.pdf" title="Paper" appPath={PAPER} />);
  expect(
    screen.getByRole("link", { name: "Open in the app" }).getAttribute("href"),
  ).toBe(openInAppUrl(PAPER));
  expect(screen.queryByTestId("pdf-viewer")).toBeNull();

  // The paper here after all (the native viewer's fallback on a local host).
  fireEvent.click(screen.getByRole("button", { name: "View it here instead" }));
  expect(screen.queryByTestId("pdf-open-in-app")).toBeNull();
  expect(screen.getByTestId("pdf-viewer")).toBeTruthy();
});

it("shows the paper on other phones and for private files", () => {
  phone(IPHONE);
  render(<PdfViewer src="/paper.pdf" title="Paper" appPath={PAPER} />);
  expect(screen.queryByTestId("pdf-open-in-app")).toBeNull();
  cleanup();

  // An upload or admin preview has no page in the app.
  phone(ANDROID);
  render(<PdfViewer src="/paper.pdf" title="Paper" />);
  expect(screen.queryByTestId("pdf-open-in-app")).toBeNull();
});

it("opens the app at the page, or Google Play without it", () => {
  expect(openInAppUrl(PAPER)).toBe(
    "intent://ourdiu.com/questions/5?submission=7#Intent;scheme=https;package=com.ourdiu.app;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.ourdiu.app;end",
  );
});
