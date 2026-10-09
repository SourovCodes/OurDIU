/** Streams an R2 object as a 200 response with its stored content type. */
export function objectResponse(object: R2ObjectBody, cacheControl: string) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("content-length", String(object.size));
  headers.set("cache-control", cacheControl);
  return new Response(object.body, { status: 200, headers });
}

/**
 * A paper's download name, e.g. "Data Structures - Final - Fall 25.pdf", the same
 * the app gives it, without characters that file systems reject.
 */
export const paperFileName = (paper: {
  course: string;
  examType: string;
  semester: string;
}) =>
  `${[paper.course, paper.examType, paper.semester]
    .join(" - ")
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, "")}.pdf`;

/**
 * Shown in the browser (the site embeds it) but saved under `filename`; non-ASCII
 * names go in `filename*`, with an ASCII fallback for old clients (RFC 6266).
 */
export function inlineDisposition(filename: string) {
  const ascii = filename
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/["\\]/g, "");
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `inline; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
