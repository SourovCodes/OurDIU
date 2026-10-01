/** Streams an R2 object as a 200 response with its stored content type. */
export function objectResponse(object: R2ObjectBody, cacheControl: string) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("content-length", String(object.size));
  headers.set("cache-control", cacheControl);
  return new Response(object.body, { status: 200, headers });
}
