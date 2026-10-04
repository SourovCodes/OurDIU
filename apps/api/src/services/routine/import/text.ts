import { getDocumentProxy } from "unpdf";

// The text of a PDF where it sits on each page, for reading a routine's grid.

/** A piece of text and where it starts: x from the left, y up from the bottom. */
export type PdfText = { x: number; y: number; width: number; text: string };

/** Each page's pieces of text, without the blank ones. */
export async function pdfText(bytes: Uint8Array): Promise<PdfText[][]> {
  const pdf = await getDocumentProxy(bytes);
  try {
    const pages: PdfText[][] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const { items } = await page.getTextContent();
      const texts: PdfText[] = [];
      for (const item of items) {
        if (!("str" in item)) continue;
        const text = item.str.replace(/\s+/g, " ").trim();
        if (!text) continue;
        texts.push({
          x: item.transform[4] as number,
          y: item.transform[5] as number,
          width: item.width,
          text,
        });
      }
      pages.push(texts);
    }
    return pages;
  } finally {
    await pdf.cleanup();
  }
}
