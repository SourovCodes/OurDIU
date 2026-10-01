import { Download, ExternalLink, FileText } from "lucide-react";
import { useSyncExternalStore } from "react";
import { buttonVariants } from "~/components/ui/button";

type PdfViewerProps = {
  /** URL of the PDF (this site or the public files domain), shown by the browser's viewer. */
  src: string;
  title: string;
};

/**
 * Google's hosted viewer, for browsers without a PDF viewer of their own. Null on a
 * local host, which Google can't fetch from (development and end-to-end tests).
 */
function googleViewerUrl(src: string) {
  if (/^(localhost|127\.|\[::1\]$)/.test(window.location.hostname)) return null;
  const absolute = new URL(src, window.location.origin).href;
  return `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(absolute)}`;
}

/** Whether a browser has a PDF viewer never changes while the page is open. */
const subscribeNever = () => () => {};

const FRAME_CLASS = "block h-[80vh] min-h-[32rem] w-full";

/**
 * Uses the browser's native PDF viewer via <object>. Most mobile browsers have none
 * (`navigator.pdfViewerEnabled` is false), so there the Google Docs viewer renders the
 * paper instead; it fetches the file from our public URL. The object's children, links
 * to open or download the file, remain the last resort.
 */
export function PdfViewer({ src, title }: PdfViewerProps) {
  // Read on the client only: the server can't know the browser, so it renders the
  // native viewer, which is what desktop browsers keep after hydration.
  const noNativeViewer = useSyncExternalStore(
    subscribeNever,
    () => navigator.pdfViewerEnabled === false,
    () => false,
  );
  const google = noNativeViewer ? googleViewerUrl(src) : null;

  return (
    <div className="overflow-hidden rounded-lg border bg-muted shadow-xs">
      {google ? (
        <iframe
          src={google}
          title={title}
          className={FRAME_CLASS}
          data-testid="pdf-viewer-google"
        />
      ) : (
        <object
          // Open parameters honoured by most native viewers: no sidebar, fit to width.
          data={`${src}#navpanes=0&view=FitH`}
          type="application/pdf"
          title={title}
          aria-label={title}
          className={FRAME_CLASS}
          data-testid="pdf-viewer"
        >
          <div
            className="flex h-full flex-col items-center justify-center gap-4 bg-card p-6 text-center"
            data-testid="pdf-viewer-fallback"
          >
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              <FileText className="size-6" aria-hidden />
            </div>
            <div className="space-y-1">
              <p className="font-medium">
                This browser can’t show the PDF here
              </p>
              <p className="text-sm text-muted-foreground">
                Open it in a new tab or download it instead.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <a
                href={src}
                target="_blank"
                rel="noopener"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <ExternalLink aria-hidden />
                Open in new tab
              </a>
              <a href={src} download className={buttonVariants({ size: "sm" })}>
                <Download aria-hidden />
                Download
              </a>
            </div>
          </div>
        </object>
      )}
    </div>
  );
}
