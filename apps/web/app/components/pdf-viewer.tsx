import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useDownloadInvite } from "~/components/android-beta";
import { buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type PdfViewerProps = {
  className?: string;
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

// On phones the paper fills the screen below the header; on larger screens most of it.
const FRAME_CLASS =
  "relative block h-[calc(100dvh-7rem)] min-h-[28rem] w-full sm:h-[80vh] sm:min-h-[32rem]";

/**
 * Uses the browser's native PDF viewer via <object>. Most mobile browsers have none
 * (`navigator.pdfViewerEnabled` is false), so there the Google Docs viewer renders the
 * paper instead; it fetches the file from our public URL. The object's children, links
 * to open or download the file, remain the last resort.
 */
export function PdfViewer({ src, title, className }: PdfViewerProps) {
  // Read on the client only: the server can't know the browser, so it renders the
  // native viewer, which is what desktop browsers keep after hydration.
  const noNativeViewer = useSyncExternalStore(
    subscribeNever,
    () => navigator.pdfViewerEnabled === false,
    () => false,
  );
  const google = noNativeViewer ? googleViewerUrl(src) : null;
  const inviteToApp = useDownloadInvite();

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl bg-surface",
        className,
      )}
    >
      {/* Behind the frame, so it shows until the paper paints over it: a blank
          question paper, header and numbered questions. */}
      <div
        aria-hidden
        className="absolute inset-0 flex justify-center overflow-hidden px-4 pt-6 sm:pt-10"
      >
        <div className="flex aspect-[1/1.414] w-full max-w-2xl flex-col gap-3 rounded-xl bg-card p-6 shadow-sm motion-safe:animate-pulse sm:gap-4 sm:p-10">
          <div className="mx-auto h-3 w-2/5 rounded-full bg-muted" />
          <div className="mx-auto h-2.5 w-3/5 rounded-full bg-muted" />
          <div className="mx-auto mb-4 h-2.5 w-1/4 rounded-full bg-muted" />
          {[0.92, 0.8, 0.86, 0.7, 0.9].map((width, i) => (
            <div key={i} className="flex gap-3 pt-2">
              <div className="size-3 shrink-0 rounded-full bg-muted" />
              <div className="grid flex-1 gap-2">
                <div
                  className="h-2.5 rounded-full bg-muted"
                  style={{ width: `${width * 100}%` }}
                />
                <div
                  className="h-2.5 rounded-full bg-muted"
                  style={{ width: `${(width - 0.25) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="absolute bottom-6 inline-flex items-center gap-2 rounded-full bg-background/90 px-4 py-2 text-sm text-muted-foreground shadow-sm">
          <Loader2 className="size-4 motion-safe:animate-spin" />
          Loading the paper…
        </p>
      </div>
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
              <a
                href={src}
                download
                onClick={inviteToApp}
                className={buttonVariants({ size: "sm" })}
              >
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
