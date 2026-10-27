import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Document, Page, pdfjs } from "react-pdf";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Button } from "~/components/ui/button";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;
/** Fit width before zoom; also used before the scroller has a real size. */
const MAX_PAGE_WIDTH = 900;
const FALLBACK_PAGE_WIDTH = 720;

export type PdfReaderProps = {
  /** URL of the PDF to read. */
  src: string;
  /** Course name (or other primary title). */
  title: string;
  /** e.g. "Final · Summer 24 · Section A". */
  details?: string;
  onClose: () => void;
};

/**
 * Full-screen paper reader: top bar with the paper's details, scrollable pages
 * in the middle, and a bottom pill for page and zoom. Loaded only when opened
 * (react-pdf + PDF.js stay out of the page's first load).
 */
export default function PdfReader({
  src,
  title,
  details,
  onClose,
}: PdfReaderProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(FALLBACK_PAGE_WIDTH);
  // Reset during render when the file changes — a mount effect would run *after*
  // Document's onLoadSuccess and wipe the page count (react-pdf default suspense).
  const [loadedSrc, setLoadedSrc] = useState(src);
  if (src !== loadedSrc) {
    setLoadedSrc(src);
    setNumPages(0);
    setPage(1);
    setZoom(1);
    pageRefs.current = [];
  }

  useEffect(() => {
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeRef.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      restoreFocusRef.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const measure = () => {
      const fitted = Math.min(scroller.clientWidth - 32, MAX_PAGE_WIDTH);
      setWidth(fitted > 0 ? fitted : FALLBACK_PAGE_WIDTH);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  const onScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || pageRefs.current.length === 0) return;
    const mid = scroller.scrollTop + scroller.clientHeight / 3;
    let current = 1;
    for (let i = 0; i < pageRefs.current.length; i++) {
      const el = pageRefs.current[i];
      if (!el) continue;
      if (el.offsetTop <= mid) current = i + 1;
      else break;
    }
    setPage((prev) => (prev === current ? prev : current));
  }, []);

  const goToPage = useCallback((next: number) => {
    setPage((prev) => {
      const total = pageRefs.current.length;
      if (total === 0) return prev;
      const clamped = Math.min(Math.max(next, 1), total);
      pageRefs.current[clamped - 1]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return clamped;
    });
  }, []);

  const zoomBy = useCallback((delta: number) => {
    setZoom((z) =>
      Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, Math.round((z + delta) * 100) / 100),
      ),
    );
  }, []);

  function onKeyDown(event: React.KeyboardEvent) {
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        onClose();
        break;
      case "ArrowLeft":
        event.preventDefault();
        goToPage(page - 1);
        break;
      case "ArrowRight":
        event.preventDefault();
        goToPage(page + 1);
        break;
      case "+":
      case "=":
        event.preventDefault();
        zoomBy(ZOOM_STEP);
        break;
      case "-":
      case "_":
        event.preventDefault();
        zoomBy(-ZOOM_STEP);
        break;
      default:
        break;
    }
  }

  const pageWidth = width * zoom;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-50 flex flex-col bg-background outline-none"
      data-testid="pdf-reader"
    >
      <header className="flex shrink-0 items-center gap-2 border-b bg-surface px-2 py-1.5 sm:px-3">
        <div className="min-w-0 flex-1 leading-tight">
          <p id={titleId} className="truncate font-expressive text-base">
            {title}
          </p>
          {details && (
            <p className="truncate text-xs text-muted-foreground">{details}</p>
          )}
        </div>
        <Button
          ref={closeRef}
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 text-muted-foreground"
        >
          <X aria-hidden />
        </Button>
      </header>

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="relative min-h-0 flex-1 overflow-auto bg-surface-low"
      >
        <div className="mx-auto w-fit px-4 py-6 pb-28">
          <Document
            key={src}
            file={src}
            // Non-suspense: show our loading UI instead of bubbling to the page
            // Suspense (whose fallback is null and would blank the reader).
            suspense={false}
            className="flex flex-col items-center gap-6"
            loading={<ReaderStatus spinning>Loading the paper…</ReaderStatus>}
            error={
              <ReaderStatus>
                Couldn’t open this paper. Close and try again, or download it.
              </ReaderStatus>
            }
            onLoadSuccess={(pdf) => {
              setNumPages(pdf.numPages);
              setPage(1);
              pageRefs.current = Array.from(
                { length: pdf.numPages },
                () => null,
              );
              scrollerRef.current?.scrollTo({ top: 0 });
            }}
          >
            {Array.from({ length: numPages }, (_, i) => (
              <div
                key={`${src}-${i + 1}`}
                ref={(el) => {
                  pageRefs.current[i] = el;
                }}
                className="overflow-hidden rounded-lg bg-card shadow-sm"
              >
                <Page
                  pageNumber={i + 1}
                  width={pageWidth}
                  renderTextLayer
                  renderAnnotationLayer={false}
                  loading={
                    <div
                      className="flex items-center justify-center bg-card"
                      style={{ width: pageWidth, aspectRatio: "1 / 1.414" }}
                    >
                      <Loader2
                        className="size-5 animate-spin text-muted-foreground"
                        aria-hidden
                      />
                    </div>
                  }
                />
              </div>
            ))}
          </Document>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-surface-high p-1.5 shadow-lg">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => zoomBy(-ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
            className="text-muted-foreground"
          >
            <ZoomOut aria-hidden />
          </Button>
          <span className="min-w-12 text-center text-xs font-medium text-muted-foreground tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => zoomBy(ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
            className="text-muted-foreground"
          >
            <ZoomIn aria-hidden />
          </Button>

          <span aria-hidden className="mx-1 h-5 w-px bg-border" />

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className="text-muted-foreground"
          >
            <ChevronLeft aria-hidden />
          </Button>
          <span
            aria-live="polite"
            className="min-w-16 px-1 text-center text-xs font-medium tabular-nums"
          >
            {numPages > 0 ? `${page} / ${numPages}` : "—"}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => goToPage(page + 1)}
            disabled={!numPages || page >= numPages}
            aria-label="Next page"
            className="text-muted-foreground"
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ReaderStatus({
  children,
  spinning = false,
}: {
  children: ReactNode;
  spinning?: boolean;
}) {
  return (
    <p className="flex items-center gap-2 px-4 py-16 text-sm text-muted-foreground">
      {spinning && (
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
      )}
      {children}
    </p>
  );
}
