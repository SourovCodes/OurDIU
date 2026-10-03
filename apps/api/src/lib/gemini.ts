import type { Fetcher } from "./pdf-processor";

/** Inline request data is capped at 20 MB, and base64 adds a third. */
export const GEMINI_MAX_INLINE_PDF_BYTES = 14 * 1024 * 1024;

/** A failure worth retrying (network, rate limit, server error). */
export class GeminiError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    /** Gemini's HTTP status, when it answered with an error. */
    readonly status?: number,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

type GenerateContentResponse = {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
};

/**
 * Sends one PDF and a prompt to Gemini in a single `generateContent` call and returns
 * the JSON reply (parsed, not validated), constrained by `responseJsonSchema`.
 */
export async function generateJsonFromPdf(options: {
  apiKey: string;
  model: string;
  pdf: Uint8Array;
  prompt: string;
  responseJsonSchema: object;
  fetch?: Fetcher;
}): Promise<{ json: unknown; text: string }> {
  if (options.pdf.byteLength > GEMINI_MAX_INLINE_PDF_BYTES) {
    throw new GeminiError(
      `The PDF is too large to analyse (${Math.round(options.pdf.byteLength / 1024 / 1024)} MB after compression)`,
      false,
    );
  }

  let res: Response;
  try {
    res = await (options.fetch ?? fetch)(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": options.apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  inline_data: {
                    mime_type: "application/pdf",
                    data: Buffer.from(options.pdf).toString("base64"),
                  },
                },
                { text: options.prompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            responseJsonSchema: options.responseJsonSchema,
          },
        }),
        signal: AbortSignal.timeout(180_000),
      },
    );
  } catch (err) {
    throw new GeminiError(`Gemini request failed: ${String(err)}`, true);
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let detail = raw.slice(0, 300);
    try {
      detail =
        (JSON.parse(raw) as { error?: { message?: string } }).error?.message ??
        detail;
    } catch {
      // Not JSON: keep the text.
    }
    throw new GeminiError(
      res.status === 400
        ? `Gemini couldn't process the file: ${detail}`
        : `Gemini returned ${res.status}: ${detail}`,
      res.status === 429 || res.status >= 500,
      res.status,
    );
  }

  const body = (await res.json()) as GenerateContentResponse;
  if (body.promptFeedback?.blockReason) {
    throw new GeminiError(
      `Gemini blocked the request (${body.promptFeedback.blockReason})`,
      false,
    );
  }
  const candidate = body.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) {
    throw new GeminiError(
      `Gemini returned no answer (${candidate?.finishReason ?? "no candidates"})`,
      true,
    );
  }
  try {
    return { json: JSON.parse(text), text };
  } catch {
    throw new GeminiError("Gemini's answer isn't valid JSON", true);
  }
}
