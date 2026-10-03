import { compressPdf, type Fetcher } from "./pdf-processor";

/** A failure that retrying won't fix. */
export class PermanentError extends Error {}

/**
 * A paper's PDF as the AI gets it: read from R2 and compressed when the compressor is
 * configured (the original if compression fails). The compressed copy isn't kept.
 */
export async function readPdfForAi(
  env: {
    BUCKET: R2Bucket;
    COMPRESSOR_API_KEY: string;
    PDF_PROCESSOR_URL: string;
  },
  fileKey: string,
  fetch?: Fetcher,
): Promise<{ original: Uint8Array; pdf: Uint8Array }> {
  const object = await env.BUCKET.get(fileKey);
  if (!object) throw new PermanentError("The PDF is missing from storage");
  const original = new Uint8Array(await object.arrayBuffer());
  const compressed = env.COMPRESSOR_API_KEY
    ? await compressPdf(original, {
        url: env.PDF_PROCESSOR_URL,
        apiKey: env.COMPRESSOR_API_KEY,
        fetch,
      })
    : null;
  return { original, pdf: compressed ?? original };
}
