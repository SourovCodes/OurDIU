import {
  A4_HEIGHT,
  A4_WIDTH,
  COVER_PAGE_HEADINGS,
  COVER_PAGE_IMAGES,
  coverPageDetails,
  coverPageLayout,
  isGroupTemplate,
  isIndexTemplate,
  isTitlePageTemplate,
  MAX_COVER_PAGE_EXPERIMENTS,
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

/** A4 with DIU's margins, framed on the first page only. */
const PAGE = {
  page: {
    size: { width: twips(A4_WIDTH), height: twips(A4_HEIGHT) },
    margin: {
      top: twips(50),
      bottom: twips(40),
      left: twips(72),
      right: twips(72),
    },
    borders: {
      pageBorders: {
        // The cover only: the work that follows has no frame.
        display: PageBorderDisplay.FIRST_PAGE,
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
};

/** The document around a page's paragraphs, with a plain page after it. */
function pack(title: string, children: (Paragraph | Table)[]) {
  const doc = new Document({
    creator: "OurDIU",
    title,
    styles: { default: { document: { run: { font: FONT } } } },
    sections: [
      {
        properties: PAGE,
        children: [
          ...children,
          // A plain page after the cover, for the work itself.
          new Paragraph({ pageBreakBefore: true, children: [] }),
        ],
      },
    ],
  });
  return Packer.toArrayBuffer(doc);
}

const logo = (width: number, before = 0) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: twips(before) },
    children: [
      new ImageRun({
        type: "png",
        data: bytes(DIU_LOGO_PNG),
        transformation: {
          width: px(width),
          height: px(
            (width * COVER_PAGE_IMAGES.logo.height) /
              COVER_PAGE_IMAGES.logo.width,
          ),
        },
        altText: {
          name: "DIU logo",
          title: "DIU logo",
          description: UNIVERSITY,
        },
      }),
    ],
  });

/** A centred paragraph of runs, with space before it in points. */
const centred = (before: number, ...children: TextRun[]) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: twips(before), line: 276 },
    children,
  });

/** A report's title page in DIU's thesis format, spaced as the PDF's. */
function titlePageDocx(
  template: CoverPageTemplate,
  value: (field: keyof CoverPageValues) => string,
) {
  const kind = template === "internship-report" ? "Internship" : "Project";
  const month = value("monthYear").toUpperCase();
  return pack(`${COVER_PAGE_HEADINGS[template].toLowerCase()} title page`, [
    logo(220, 8),
    centred(
      24,
      run(COVER_PAGE_HEADINGS[template], 11, { bold: true, color: NAVY }),
    ),
    centred(10, run(value("topic"), 20, { bold: true })),
    centred(40, run("BY", 12, { bold: true, color: NAVY })),
    centred(4, run(value("studentName"), 13, { bold: true })),
    ...(value("studentId")
      ? [centred(0, run(`ID: ${value("studentId")}`, 12))]
      : []),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: twips(36), line: 360 },
      indent: { left: twips(28), right: twips(28) },
      children: [
        run(
          `This ${kind} Report Presented in Partial Fulfillment of the Requirements for the Degree of ${value("degree")}`.trim(),
          12,
        ),
      ],
    }),
    centred(48, run("Supervised By", 12, { bold: true, color: NAVY })),
    centred(4, run(value("teacherName"), 13, { bold: true })),
    ...(value("teacherDesignation")
      ? [centred(0, run(value("teacherDesignation"), 12))]
      : []),
    ...(value("teacherDepartment")
      ? [centred(0, run(value("teacherDepartment"), 12))]
      : []),
    centred(0, run(UNIVERSITY, 12)),
    centred(110, run(UNIVERSITY.toUpperCase(), 13, { bold: true })),
    centred(0, run("DHAKA, BANGLADESH", 12)),
    ...(month ? [centred(0, run(month, 12))] : []),
  ]);
}

const LINE = { style: BorderStyle.SINGLE, size: 6, color: INK };
const GRID = {
  top: LINE,
  bottom: LINE,
  left: LINE,
  right: LINE,
  insideHorizontal: LINE,
  insideVertical: LINE,
};

/** The lab report index: the course and student over a table of experiments. */
function indexDocx(
  values: CoverPageValues,
  value: (field: keyof CoverPageValues) => string,
) {
  const SIZE = 11;
  type Pair = [label: string, field: keyof CoverPageValues];
  // Two details side by side, or one across the row.
  const pair = (...cells: Pair[]) =>
    new TableRow({
      children: cells.map(
        ([label, field]) =>
          new TableCell({
            borders: NO_BORDERS,
            columnSpan: cells.length === 1 ? 2 : 1,
            children: [labelled(label, value(field), SIZE)],
          }),
      ),
    });
  const info = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    rows: [
      pair(["Course Code", "courseCode"], ["Section", "section"]),
      pair(["Course Title", "courseTitle"]),
      pair(["Name", "studentName"], ["ID", "studentId"]),
      pair(["Course Teacher", "teacherName"], ["Semester", "semester"]),
    ],
  });
  // Column widths in points, as the PDF's.
  const widths = [32, 495 - 32 - 72 - 72 - 70, 72, 72, 70];
  const cell = (text: string, i: number, head = false) =>
    new TableCell({
      width: { size: twips(widths[i]!), type: WidthType.DXA },
      verticalAlign: "center",
      children: [
        new Paragraph({
          alignment:
            i === 1 && !head ? AlignmentType.LEFT : AlignmentType.CENTER,
          children: [
            run(text, head ? 9.5 : 10, head ? { bold: true, color: NAVY } : {}),
          ],
        }),
      ],
    });
  const experiments = (values.experiments ?? []).slice(
    0,
    MAX_COVER_PAGE_EXPERIMENTS,
  );
  const rows = Array.from({ length: MAX_COVER_PAGE_EXPERIMENTS }, (_, i) => {
    const e = experiments[i];
    return new TableRow({
      height: { value: twips(40), rule: "atLeast" },
      children: [
        cell(e?.no.trim() ?? "", 0),
        cell(e?.name.trim() ?? "", 1),
        cell(e?.performedOn.trim() ?? "", 2),
        cell(e?.submittedOn.trim() ?? "", 3),
        cell("", 4),
      ],
    });
  });
  const table = new Table({
    width: { size: twips(495), type: WidthType.DXA },
    columnWidths: widths.map(twips),
    layout: TableLayoutType.FIXED,
    borders: GRID,
    rows: [
      new TableRow({
        tableHeader: true,
        height: { value: twips(34), rule: "atLeast" },
        children: [
          "No.",
          "Name of the Experiment",
          "Date of Experiment",
          "Date of Submission",
          "Signature",
        ].map((h, i) => cell(h, i, true)),
      }),
      ...rows,
    ],
  });
  return pack(`${value("courseCode") || "Lab report"} index`, [
    logo(180),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: twips(14), after: twips(14) },
      children: [
        run(COVER_PAGE_HEADINGS["lab-report-index"], 15, {
          bold: true,
          color: NAVY,
          underline: true,
        }),
      ],
    }),
    info,
    new Paragraph({ spacing: { after: twips(10) }, children: [] }),
    table,
  ]);
}

export async function coverPageDocx(
  template: CoverPageTemplate,
  values: CoverPageValues,
): Promise<ArrayBuffer> {
  const value = (field: keyof CoverPageValues) =>
    typeof values[field] === "string" ? (values[field] as string).trim() : "";
  if (isTitlePageTemplate(template)) return titlePageDocx(template, value);
  if (isIndexTemplate(template)) return indexDocx(values, value);

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
        properties: PAGE,
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
          // A plain page after the cover, for the work itself. Without it the
          // date's box is the document's last paragraph, and in Word and Google
          // Docs the cursor can't get out of it.
          new Paragraph({ pageBreakBefore: true, children: [] }),
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
