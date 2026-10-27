import {
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Maximize,
  Smartphone,
} from "lucide-react";
import { useEffect, useSyncExternalStore, type RefObject } from "react";
import { Button, buttonVariants } from "~/components/ui/button";
import { trackEvent } from "~/lib/analytics";
import { isAndroid, openInAppUrl } from "~/lib/android-app";
import { cn } from "~/lib/utils";

type PdfViewerProps = {
  className?: string;
  /** URL of the PDF (this site or the public files domain), shown by the browser's viewer. */
  src: string;
  title: string;
  /**
   * The page in the app (a public paper's), for Android browsers: they have no PDF
   * viewer, so they're asked to read it in the app.
   */
  appPath?: string;
  /**
   * The frame's height from `lg`, to fit what the page puts around it (by default,
   * the screen below the site's header with a little room).
   */
  frameClassName?: string;
};

/** Whether a browser has a PDF viewer never changes while the page is open. */
const subscribeNever = () => () => {};

// The paper fills the screen below the site's header (and the paper's bar below it on
// phones), so once it's scrolled to, all of it is in view and scrolling inside it
// doesn't stop at an edge off the screen.
const FRAME_CLASS =
  "relative block h-[calc(100dvh-7rem)] min-h-[28rem] w-full sm:min-h-[32rem] lg:h-[calc(100dvh-6rem)]";

/**
 * Uses the browser's native PDF viewer via <object>. Browsers without one (most
 * phones': `navigator.pdfViewerEnabled` is false) get links to open the file in a
 * tab, where the phone's own viewer takes it, or to download it; on Android a public
 * paper (`appPath`) also offers it in the app. The object's children, the same
 * links, cover browsers that say they have a viewer but can't embed it.
 */
export function PdfViewer({
  src,
  title,
  appPath,
  className,
  frameClassName,
}: PdfViewerProps) {
  // Read on the client only: the server can't know the browser, so it renders the
  // native viewer, which is what desktop browsers keep after hydration.
  const noNativeViewer = useSyncExternalStore(
    subscribeNever,
    () => navigator.pdfViewerEnabled === false,
    () => false,
  );
  const android = useSyncExternalStore(
    subscribeNever,
    () => isAndroid(navigator.userAgent),
    () => false,
  );

  if (noNativeViewer) {
    return appPath && android ? (
      <OpenInApp href={openInAppUrl(appPath)} src={src} className={className} />
    ) : (
      <NoViewer src={src} className={cn("min-h-[24rem]", className)} />
    );
  }

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
      <object
        // Open parameters honoured by most native viewers: no sidebar, fit to width.
        data={`${src}#navpanes=0&view=FitH`}
        type="application/pdf"
        title={title}
        aria-label={title}
        className={cn(FRAME_CLASS, frameClassName)}
        data-testid="pdf-viewer"
      >
        <NoViewer src={src} className="h-full" />
      </object>
    </div>
  );
}

/**
 * Shows the embedded paper (a `PdfViewer` inside `container`) on the whole screen;
 * Esc brings it back. Only where the browser embeds PDFs and allows full screen.
 */
export function PdfFullScreenButton({
  container,
}: {
  container: RefObject<HTMLElement | null>;
}) {
  // Rendered on the server, as desktop browsers keep it: appearing after loading
  // would move the bar's other controls.
  const available = useSyncExternalStore(
    subscribeNever,
    () => document.fullscreenEnabled && navigator.pdfViewerEnabled !== false,
    () => true,
  );
  if (!available) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        const frame = container.current?.querySelector(
          '[data-testid="pdf-viewer"]',
        );
        // The browser can still refuse (e.g. in an iframe without permission).
        frame
          ?.requestFullscreen()
          .then(() => trackEvent("paper_full_screen"))
          .catch(() => {});
      }}
    >
      <Maximize aria-hidden />
      Full screen
    </Button>
  );
}

/** The file's links, for browsers that can't show it in the page. */
function PdfLinks({ src, onClick }: { src: string; onClick?: () => void }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      <a
        href={src}
        target="_blank"
        rel="noopener"
        onClick={onClick}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <ExternalLink aria-hidden />
        Open the PDF
      </a>
      <a
        href={src}
        download
        onClick={onClick}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <Download aria-hidden />
        Download
      </a>
    </div>
  );
}

/** In place of the viewer where the browser has none. */
function NoViewer({ src, className }: { src: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 bg-card p-6 text-center",
        className,
      )}
      data-testid="pdf-viewer-fallback"
    >
      <div className="rounded-full bg-primary/10 p-3 text-primary">
        <FileText className="size-6" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="font-medium">This browser can’t show the PDF here</p>
        <p className="text-sm text-muted-foreground">
          Open it, and your phone’s PDF viewer takes it, or download it.
        </p>
      </div>
      <PdfLinks src={src} />
    </div>
  );
}

/** In place of the viewer on Android: the paper in the app, or the file itself. */
function OpenInApp({
  href,
  src,
  className,
}: {
  href: string;
  src: string;
  className?: string;
}) {
  useEffect(() => trackEvent("app_card_shown"), []);
  return (
    <div
      className={cn(
        "flex min-h-[24rem] flex-col items-center justify-center gap-5 bg-surface p-6 text-center",
        className,
      )}
      data-testid="pdf-open-in-app"
    >
      <div className="rounded-full bg-primary-container p-4 text-primary-container-foreground">
        <Smartphone className="size-7" aria-hidden />
      </div>
      <div className="max-w-xs space-y-1">
        <p className="font-expressive text-2xl">Read it in the app</p>
        <p className="text-sm text-pretty text-muted-foreground">
          Papers open full screen in the OurDIU app, and you can save them for
          exam week. Free on Google Play.
        </p>
      </div>
      <a
        href={href}
        onClick={() => trackEvent("app_card_open")}
        className={buttonVariants({ size: "lg" })}
      >
        <Smartphone aria-hidden />
        Open in the app
      </a>
      <PdfLinks src={src} onClick={() => trackEvent("app_card_pdf")} />
    </div>
  );
}
