import {
  A4_HEIGHT,
  COVER_PAGE_HEADINGS,
  COVER_PAGE_IMAGES,
  coverPageDetails,
  coverPageLayout,
  isGroupTemplate,
  MAX_COVER_PAGE_MEMBERS,
  textWidth,
  UNIVERSITY,
  type CoverPageTemplate,
  type CoverPageValues,
} from "@ourdiu/shared/cover-pages";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HorizontalPositionRelativeFrom,
  ImageRun,
  Packer,
  PageBorderDisplay,
  PageBorderOffsetFrom,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  TextWrappingType,
  UnderlineType,
  VerticalPositionRelativeFrom,
  WidthType,
} from "docx";
import { DIU_CREST_FAINT_PNG, DIU_LOGO_PNG } from "./images";

// A cover page as a Word document (docs/PLAN.md, decision 42: many search for a
// "doc file"), to edit in Word or Google Docs. Word flows text rather than placing
// it, so the gaps come from the PDF's layout (`coverPageLayout`), and the page
// looks the same. Unlike the PDF it keeps any script, Bangla included.

const FONT = "Arial";
const INK = "111111";
const NAVY = "1F3A68";

/** Points to Word's units. */
const twips = (pt: number) => Math.round(pt * 20);
const halfPoints = (pt: number) => Math.round(pt * 2);
/** docx sizes images in pixels at 96 per inch. */
const px = (pt: number) => (pt * 96) / 72;

const bytes = (base64: string) =>
  Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

const run = (
  text: string,
  size: number,
  {
    bold = false,
    color = INK,
    underline = false,
  }: { bold?: boolean; color?: string; underline?: boolean } = {},
) =>
  new TextRun({
    text,
    font: FONT,
    size: halfPoints(size),
    bold,
    color,
    ...(underline ? { underline: { type: UnderlineType.SINGLE } } : {}),
  });

/** "Label: value", the label bold. */
const labelled = (label: string, value: string, size: number, after = 0) =>
  new Paragraph({
    spacing: { after: twips(after), line: 276 },
    children: [run(`${label}: `, size, { bold: true }), run(value, size)],
  });

const boldLine = (text: string, size: number) =>
  new Paragraph({ children: [run(text, size, { bold: true })] });

const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

export async function coverPageDocx(
  template: CoverPageTemplate,
  values: CoverPageValues,
): Promise<ArrayBuffer> {
  const value = (field: keyof CoverPageValues) =>
    typeof values[field] === "string" ? (values[field] as string).trim() : "";

  // Where the PDF puts things, to space the document the same way.
  const items = coverPageLayout(template, values);
  const texts = items.flatMap((i) => (i.kind === "text" ? [i] : []));
  const at = (text: string) => texts.find((t) => t.text === text)?.y ?? 0;
  const submittedTop = at("Submitted To");
  const detailsEnd = Math.max(
    ...texts.filter((t) => t.y > 200 && t.y < submittedTop).map((t) => t.y),
  );
  const columnsEnd = Math.max(
    ...texts.filter((t) => t.y > submittedTop && t.y < 760).map((t) => t.y),
  );

  const { width: logoW, height: logoH } = COVER_PAGE_IMAGES.logo;
  const { width: crestW, height: crestH } = COVER_PAGE_IMAGES.crest;
  const crest = items.find((i) => i.kind === "image" && i.image === "crest");

  const details = coverPageDetails(template).map(([label, field]) =>
    labelled(label, value(field), 14, 8),
  );

  const SIZE = 11;
  const heading = (text: string) =>
    new Paragraph({
      spacing: { after: twips(8) },
      children: [run(text, 12.5, { bold: true, color: NAVY, underline: true })],
    });

  const teacher = [
    heading("Submitted To"),
    labelled("Name", value("teacherName"), SIZE),
    labelled("Designation", value("teacherDesignation"), SIZE),
    ...(value("teacherDepartment")
      ? [boldLine(value("teacherDepartment"), SIZE)]
      : []),
    boldLine(UNIVERSITY, SIZE),
  ];

  const members = (values.members ?? [])
    .slice(0, MAX_COVER_PAGE_MEMBERS)
    .map((m) => ({ name: m.name.trim(), id: m.id.trim() }))
    .filter((m) => m.name || m.id);
  const student = [
    heading("Submitted By"),
    ...(isGroupTemplate(template)
      ? members.map(
          (m) =>
            new Paragraph({
              children: [
                run(m.name, SIZE),
                ...(m.id ? [run(`  ${m.id}`, SIZE, { bold: true })] : []),
              ],
            }),
        )
      : [
          labelled("Name", value("studentName"), SIZE),
          labelled("ID", value("studentId"), SIZE),
        ]),
    labelled("Section", value("section"), SIZE),
    labelled("Semester", value("semester"), SIZE),
    ...(value("studentDepartment")
      ? [boldLine(value("studentDepartment"), SIZE)]
      : []),
    boldLine(UNIVERSITY, SIZE),
  ];

  const column = (children: Paragraph[]) =>
    new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      borders: NO_BORDERS,
      children,
    });

  const navyBorder = { style: BorderStyle.SINGLE, size: 10, color: NAVY };
  const CONTENT = 595.28 - 2 * 72;
  const dateBox = Math.min(
    CONTENT,
    textWidth(`Date of Submission: ${value("date")}`, 12, true) + 40,
  );
  const side = Math.round((twips(CONTENT) - twips(dateBox)) / 2);

  const doc = new Document({
    creator: "OurDIU",
    title: `${value("courseCode") || "Cover"} cover page`,
    styles: { default: { document: { run: { font: FONT } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: twips(595.28), height: twips(A4_HEIGHT) },
            margin: {
              top: twips(50),
              bottom: twips(40),
              left: twips(72),
              right: twips(72),
            },
            borders: {
              pageBorders: {
                display: PageBorderDisplay.ALL_PAGES,
                offsetFrom: PageBorderOffsetFrom.PAGE,
              },
              pageBorderTop: {
                style: BorderStyle.SINGLE,
                size: 8,
                color: INK,
                space: 22,
              },
              pageBorderBottom: {
                style: BorderStyle.SINGLE,
                size: 8,
                color: INK,
                space: 22,
              },
              pageBorderLeft: {
                style: BorderStyle.SINGLE,
                size: 8,
                color: INK,
                space: 22,
              },
              pageBorderRight: {
                style: BorderStyle.SINGLE,
                size: 8,
                color: INK,
                space: 22,
              },
            },
          },
        },
        children: [
          // DIU's logo, with the faint crest behind the page's middle.
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                type: "png",
                data: bytes(DIU_LOGO_PNG),
                transformation: {
                  width: px(260),
                  height: px((260 * logoH) / logoW),
                },
                altText: {
                  name: "DIU logo",
                  title: "DIU logo",
                  description: UNIVERSITY,
                },
              }),
              ...(crest && crest.kind === "image"
                ? [
                    new ImageRun({
                      type: "png",
                      data: bytes(DIU_CREST_FAINT_PNG),
                      transformation: {
                        width: px(crest.w),
                        height: px((crest.w * crestH) / crestW),
                      },
                      floating: {
                        // Offsets, not "centre": some readers ignore alignment.
                        horizontalPosition: {
                          relative: HorizontalPositionRelativeFrom.PAGE,
                          offset: Math.round(crest.x * 12700),
                        },
                        verticalPosition: {
                          relative: VerticalPositionRelativeFrom.PAGE,
                          offset: Math.round(crest.y * 12700),
                        },
                        behindDocument: true,
                        wrap: { type: TextWrappingType.NONE },
                      },
                      altText: {
                        name: "DIU crest",
                        title: "DIU crest",
                        description: "",
                      },
                    }),
                  ]
                : []),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: twips(34), after: twips(26) },
            children: [
              run(COVER_PAGE_HEADINGS[template], 16, {
                bold: true,
                color: NAVY,
                underline: true,
              }),
            ],
          }),
          ...details,
          // Down to where the PDF has "Submitted To".
          new Paragraph({
            spacing: {
              before: twips(Math.max(12, submittedTop - detailsEnd - 40)),
            },
            children: [],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: NO_BORDERS,
            rows: [
              new TableRow({ children: [column(teacher), column(student)] }),
            ],
          }),
          new Paragraph({
            spacing: { before: twips(Math.max(12, 762 - columnsEnd - 24)) },
            children: [],
          }),
          // The date, boxed in the middle: a bordered paragraph narrowed by
          // equal indents, which every reader draws alike.
          new Paragraph({
            alignment: AlignmentType.CENTER,
            indent: { left: side, right: side },
            border: {
              top: { ...navyBorder, space: 3 },
              bottom: { ...navyBorder, space: 3 },
              left: { ...navyBorder, space: 6 },
              right: { ...navyBorder, space: 6 },
            },
            children: [
              run(`Date of Submission: ${value("date")}`, 12, {
                bold: true,
                color: NAVY,
              }),
            ],
          }),
        ],
      },
    ],
  });
  return Packer.toArrayBuffer(doc);
}

/** "CSE311-assignment-cover.docx". */
export function coverPageDocxFilename(
  template: CoverPageTemplate,
  courseCode: string | undefined,
) {
  const code = (courseCode ?? "").replace(/[^A-Za-z0-9-]/g, "");
  return `${code ? `${code}-` : ""}${template}-cover.docx`;
}
