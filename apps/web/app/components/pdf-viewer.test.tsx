import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { APP_DECLINES_COOKIE, openInAppUrl } from "~/lib/android-app";
import { useHotkey } from "~/lib/keyboard";
import {
  PdfFullScreenButton,
  PdfViewer,
  requestPaperFullscreen,
} from "./pdf-viewer";

const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
const OTHER_PHONE =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // The full screen stubs (jsdom has neither).
  delete (document as { fullscreenEnabled?: boolean }).fullscreenEnabled;
  delete (document as { fullscreenElement?: Element | null }).fullscreenElement;
  delete (Element.prototype as { requestFullscreen?: unknown })
    .requestFullscreen;
  delete (document as { exitFullscreen?: unknown }).exitFullscreen;
});

/** A browser without a PDF viewer of its own, like most phones'. */
function noViewer(userAgent: string) {
  vi.stubGlobal("navigator", {
    ...navigator,
    userAgent,
    pdfViewerEnabled: false,
  });
}

const PAPER = "/questions/5?submission=7";

function fileLinks() {
  return [
    screen.getByRole("link", { name: "Open the PDF" }),
    screen.getByRole("link", { name: "Download" }),
  ].map((link) => link.getAttribute("href"));
}

it("asks Android visitors to read a public paper in the app, or open the file", () => {
  noViewer(ANDROID);
  render(<PdfViewer src="/paper.pdf" title="Paper" appPath={PAPER} />);
  expect(
    screen.getByRole("link", { name: "Open in the app" }).getAttribute("href"),
  ).toBe(openInAppUrl(PAPER));
  expect(fileLinks()).toEqual(["/paper.pdf", "/paper.pdf"]);
  expect(screen.queryByTestId("pdf-viewer")).toBeNull();
  expect(document.querySelector("iframe")).toBeNull();
});

it("stops offering the app after two no's", () => {
  noViewer(ANDROID);
  render(<PdfViewer src="/paper.pdf" title="Paper" appPath={PAPER} />);
  fireEvent.click(screen.getByRole("link", { name: "Open the PDF" }));
  cleanup();

  // One "no": still offered.
  render(<PdfViewer src="/paper.pdf" title="Paper" appPath={PAPER} />);
  expect(screen.getByTestId("pdf-open-in-app")).toBeTruthy();
  fireEvent.click(screen.getByRole("link", { name: "Download" }));
  cleanup();

  // Two: just the file from now on.
  render(<PdfViewer src="/paper.pdf" title="Paper" appPath={PAPER} />);
  expect(screen.queryByTestId("pdf-open-in-app")).toBeNull();
  expect(fileLinks()).toEqual(["/paper.pdf", "/paper.pdf"]);
  document.cookie = `${APP_DECLINES_COOKIE}=; Max-Age=0; Path=/`;
});

it("offers the file where there's no viewer and no app", () => {
  noViewer(OTHER_PHONE);
  render(<PdfViewer src="/paper.pdf" title="Paper" appPath={PAPER} />);
  expect(screen.queryByTestId("pdf-open-in-app")).toBeNull();
  expect(fileLinks()).toEqual(["/paper.pdf", "/paper.pdf"]);
  cleanup();

  // An upload or admin preview has no page in the app.
  noViewer(ANDROID);
  render(<PdfViewer src="/own.pdf" title="Paper" />);
  expect(screen.queryByTestId("pdf-open-in-app")).toBeNull();
  expect(fileLinks()).toEqual(["/own.pdf", "/own.pdf"]);
  expect(document.querySelector("iframe")).toBeNull();
});

it("embeds the paper where the browser has a viewer", () => {
  render(<PdfViewer src="/paper.pdf" title="Paper" appPath={PAPER} />);
  expect(screen.getByTestId("pdf-viewer").getAttribute("data")).toBe(
    "/paper.pdf#navpanes=0&view=FitH",
  );
});

it("opens the app at the page, or Google Play without it", () => {
  expect(openInAppUrl(PAPER)).toBe(
    "intent://ourdiu.com/questions/5?submission=7#Intent;scheme=https;package=com.ourdiu.app;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.ourdiu.app;end",
  );
});

/** jsdom has no full screen: say whether the browser allows it. */
function fullscreenEnabled(enabled: boolean) {
  Object.defineProperty(document, "fullscreenEnabled", {
    value: enabled,
    configurable: true,
  });
}

function PaperWithFullScreen() {
  const ref = useRef<HTMLDivElement>(null);
  useHotkey("f", () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return true;
    }
    void requestPaperFullscreen(ref.current);
    return true;
  });
  return (
    <div ref={ref}>
      <PdfFullScreenButton container={ref} />
      <PdfViewer src="/paper.pdf" title="Paper" />
    </div>
  );
}

it("shows the embedded paper on the whole screen", () => {
  fullscreenEnabled(true);
  const requestFullscreen = vi.fn(() => Promise.resolve());
  Element.prototype.requestFullscreen = requestFullscreen;
  render(<PaperWithFullScreen />);
  fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
  expect(requestFullscreen).toHaveBeenCalledOnce();
  expect(requestFullscreen.mock.contexts[0]).toBe(
    screen.getByTestId("pdf-viewer"),
  );
});

it("toggles full screen with f, like YouTube", () => {
  fullscreenEnabled(true);
  const requestFullscreen = vi.fn(() => Promise.resolve());
  const exitFullscreen = vi.fn(() => Promise.resolve());
  Element.prototype.requestFullscreen = requestFullscreen;
  document.exitFullscreen = exitFullscreen;
  render(<PaperWithFullScreen />);

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "f" }));
  expect(requestFullscreen).toHaveBeenCalledOnce();

  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => screen.getByTestId("pdf-viewer"),
  });
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "F" }));
  expect(exitFullscreen).toHaveBeenCalledOnce();
  delete (document as { fullscreenElement?: Element | null }).fullscreenElement;
});

it("has no full screen button where the browser can't embed or allow it", () => {
  fullscreenEnabled(false);
  render(<PaperWithFullScreen />);
  expect(screen.queryByRole("button", { name: "Full screen" })).toBeNull();
  cleanup();

  fullscreenEnabled(true);
  noViewer(OTHER_PHONE);
  render(<PaperWithFullScreen />);
  expect(screen.queryByRole("button", { name: "Full screen" })).toBeNull();
});
