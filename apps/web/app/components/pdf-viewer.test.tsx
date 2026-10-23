import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { openInAppUrl } from "~/lib/android-app";
import { PdfViewer } from "./pdf-viewer";

const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
const OTHER_PHONE =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
