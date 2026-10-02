// Client for the PDF processor API (pdf-processor.diuqbank.com): compression and watermarks.

export type Fetcher = typeof fetch;

/**
 * Compresses a PDF with Ghostscript's ebook preset. Returns null when the service
 * fails or doesn't make the file smaller: compression only cuts AI cost, so callers
 * carry on with the original.
 */
export async function compressPdf(
  pdf: Uint8Array<ArrayBuffer>,
  options: { url: string; apiKey: string; fetch?: Fetcher },
): Promise<Uint8Array<ArrayBuffer> | null> {
  const body = new FormData();
  body.append("pdf", new File([pdf], "paper.pdf", { type: "application/pdf" }));
  try {
    const res = await (options.fetch ?? fetch)(
      new URL("/api/pdfs/compress", options.url),
      {
        method: "POST",
        headers: { "X-API-Key": options.apiKey },
        body,
        signal: AbortSignal.timeout(60_000),
      },
    );
    if (!res.ok) {
      console.warn(
        `PDF compression failed: ${res.status} ${await res.text().catch(() => "")}`,
      );
      return null;
    }
    const compressed = new Uint8Array(await res.arrayBuffer());
    return compressed.byteLength < pdf.byteLength ? compressed : null;
  } catch (err) {
    console.warn("PDF compression failed", err);
    return null;
  }
}

/** A failed watermark request; `retryable` is false when the service rejected it. */
export class PdfProcessorError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "PdfProcessorError";
  }
}

/**
 * Adds `credit` as a header line on every page and stamps `stamp` faintly at random
 * positions and angles across each page, then compresses the PDF like `compressPdf`.
 * Throws a `PdfProcessorError` on failure.
 */
export async function watermarkPdf(
  pdf: Uint8Array<ArrayBuffer>,
  text: { credit: string; stamp: string },
  options: { url: string; apiKey: string; fetch?: Fetcher },
): Promise<Uint8Array<ArrayBuffer>> {
  const body = new FormData();
  body.append("pdf", new File([pdf], "paper.pdf", { type: "application/pdf" }));
  body.append("credit_text", text.credit);
  body.append("watermark_text", text.stamp);
  let res: Response;
  try {
    res = await (options.fetch ?? fetch)(
      new URL("/api/pdfs/credit-watermark-compress", options.url),
      {
        method: "POST",
        headers: { "X-API-Key": options.apiKey },
        body,
        signal: AbortSignal.timeout(120_000),
      },
    );
  } catch (err) {
    throw new PdfProcessorError(
      `The PDF processor didn't answer: ${err instanceof Error ? err.message : String(err)}`,
      true,
    );
  }
  if (!res.ok) {
    const reply = await res.text().catch(() => "");
    let message = reply;
    try {
      message = (JSON.parse(reply) as { message?: string }).message ?? reply;
    } catch {
      // Not JSON: keep the raw text.
    }
    // 4xx: a bad key or a PDF it can't process, which retrying won't fix.
    throw new PdfProcessorError(
      `The PDF processor failed (${res.status})${message ? `: ${message.slice(0, 300)}` : ""}`,
      res.status >= 500 || res.status === 429,
    );
  }
  return new Uint8Array(await res.arrayBuffer());
}
