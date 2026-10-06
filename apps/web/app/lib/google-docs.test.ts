import { afterEach, describe, expect, it, vi } from "vitest";
import { saveAsGoogleDoc } from "./google-docs";

afterEach(() => vi.unstubAllGlobals());

describe("saveAsGoogleDoc", () => {
  it("uploads the Word file to Drive as a Google Doc and returns its link", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        id: "abc",
        webViewLink: "https://docs.google.com/document/d/abc/edit",
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const docx = new Blob(["PK fake docx"]);

    const link = await saveAsGoogleDoc(
      "token-1",
      docx,
      "CSE311 assignment cover",
    );

    expect(link).toBe("https://docs.google.com/document/d/abc/edit");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    );
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token-1");
    const boundary = /boundary=(.+)$/.exec(headers["Content-Type"]!)![1]!;
    const body = await (init.body as Blob).text();
    // Converted to a Google Doc on upload, under the cover page's name.
    expect(body).toContain(
      JSON.stringify({
        name: "CSE311 assignment cover",
        mimeType: "application/vnd.google-apps.document",
      }),
    );
    expect(body).toContain("PK fake docx");
    expect(body.trimEnd().endsWith(`--${boundary}--`)).toBe(true);
  });

  it("fails when Drive refuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 403 })),
    );
    await expect(saveAsGoogleDoc("t", new Blob([]), "x")).rejects.toThrow(
      "403",
    );
  });
});
