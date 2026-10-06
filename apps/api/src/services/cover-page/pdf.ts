import {
  A4_HEIGHT,
  A4_WIDTH,
  COVER_PAGE_COLORS,
  coverPageLayout,
  type CoverPageTemplate,
  type CoverPageValues,
} from "@ourdiu/shared/cover-pages";
import { PDFDocument, rgb, StandardFonts, type PDFImage } from "pdf-lib";
import { DIU_CREST_PNG, DIU_LOGO_PNG } from "./images";

// A cover page as a one-page A4 PDF (docs/PLAN.md, decision 39), drawn from the
// same layout as the website's preview. Made from what's sent and not kept.

const color = (hex: string) =>
  rgb(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  );

/** A rounded rectangle's outline as an SVG path, from its top-left corner. */
function roundedRect(w: number, h: number, r: number) {
  return [
    `M ${r} 0 H ${w - r}`,
    `A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r}`,
    `A ${r} ${r} 0 0 1 0 ${h - r} V ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0 Z`,
  ].join(" ");
}

export async function coverPagePdf(
  template: CoverPageTemplate,
  values: CoverPageValues,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${values.courseCode || "Cover"} cover page`);
  doc.setCreator("OurDIU");
  const page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const images: Record<"logo" | "crest", PDFImage> = {
    logo: await doc.embedPng(DIU_LOGO_PNG),
    crest: await doc.embedPng(DIU_CREST_PNG),
  };
  // The layout measures y down from the top; PDF measures it up from the bottom.
  const flip = (y: number) => A4_HEIGHT - y;

  for (const item of coverPageLayout(template, values)) {
    if (item.kind === "image") {
      page.drawImage(images[item.image], {
        x: item.x,
        y: flip(item.y + item.h),
        width: item.w,
        height: item.h,
        opacity: item.opacity,
      });
      continue;
    }
    const ink = color(COVER_PAGE_COLORS[item.color]);
    if (item.kind === "text") {
      if (!item.text) continue;
      page.drawText(item.text, {
        x: item.x,
        y: flip(item.y),
        size: item.size,
        font: item.bold ? bold : regular,
        color: ink,
      });
    } else if (item.kind === "line") {
      page.drawLine({
        start: { x: item.x1, y: flip(item.y1) },
        end: { x: item.x2, y: flip(item.y2) },
        thickness: item.width,
        color: ink,
      });
    } else if (item.radius > 0) {
      page.drawSvgPath(roundedRect(item.w, item.h, item.radius), {
        x: item.x,
        y: flip(item.y),
        borderColor: ink,
        borderWidth: item.width,
      });
    } else {
      page.drawRectangle({
        x: item.x,
        y: flip(item.y + item.h),
        width: item.w,
        height: item.h,
        borderColor: ink,
        borderWidth: item.width,
      });
    }
  }
  return doc.save();
}

/** "CSE311-assignment-cover.pdf". */
export function coverPageFilename(
  template: CoverPageTemplate,
  courseCode: string | undefined,
) {
  const code = (courseCode ?? "").replace(/[^A-Za-z0-9-]/g, "");
  return `${code ? `${code}-` : ""}${template}-cover.pdf`;
}
