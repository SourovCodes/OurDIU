import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("react-pdf", () => ({
  pdfjs: { GlobalWorkerOptions: { workerSrc: "" } },
  Document: ({
    children,
    onLoadSuccess,
  }: {
    children: React.ReactNode;
    onLoadSuccess?: (info: { numPages: number }) => void;
  }) => {
    // Resolve after paint so the test can wait for pages.
    queueMicrotask(() => onLoadSuccess?.({ numPages: 3 }));
    return <div data-testid="pdf-document">{children}</div>;
  },
  Page: ({ pageNumber }: { pageNumber: number }) => (
    <div data-testid={`pdf-page-${pageNumber}`}>Page {pageNumber}</div>
  ),
}));

vi.mock("react-pdf/dist/Page/AnnotationLayer.css", () => ({}));
vi.mock("react-pdf/dist/Page/TextLayer.css", () => ({}));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({
  default: "/pdf.worker.min.mjs",
}));

import PdfReader from "./pdf-reader";

afterEach(() => {
  cleanup();
});

it("shows the paper's title and a close control", () => {
  const onClose = vi.fn();
  render(
    <PdfReader
      src="/paper.pdf"
      title="Data Structures"
      details="Final · Summer 24"
      onClose={onClose}
    />,
  );
  expect(screen.getByRole("dialog", { name: "Data Structures" })).toBeTruthy();
  expect(screen.getByText("Final · Summer 24")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(onClose).toHaveBeenCalledOnce();
});

it("zooms and steps through pages once the document loads", async () => {
  render(
    <PdfReader src="/paper.pdf" title="Data Structures" onClose={() => {}} />,
  );
  expect(await screen.findByTestId("pdf-page-1")).toBeTruthy();
  expect(screen.getByTestId("pdf-page-3")).toBeTruthy();
  expect(screen.getByText("1 / 3")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  expect(screen.getByText("125%")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(screen.getByText("2 / 3")).toBeTruthy();
});

it("closes on Escape", () => {
  const onClose = vi.fn();
  render(
    <PdfReader src="/paper.pdf" title="Data Structures" onClose={onClose} />,
  );
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalledOnce();
});
