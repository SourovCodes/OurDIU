// The cover page maker's templates (docs/PLAN.md, decisions 39 and 40): what each
// asks for and where everything goes on the A4 page. One layout, drawn twice: as
// SVG for the website's live preview and as a PDF by the API, so they match. No
// Zod here: browser code imports it (`@ourdiu/shared/cover-pages`).

/** In the order students search for them; each is a page at `coverPagePath`. */
export const COVER_PAGE_TEMPLATES = [
  "assignment",
  "lab-report",
  "group-assignment",
  "final-lab-report",
  "presentation",
] as const;
export type CoverPageTemplate = (typeof COVER_PAGE_TEMPLATES)[number];

export const COVER_PAGE_TEMPLATE_NAMES: Record<CoverPageTemplate, string> = {
  assignment: "Assignment",
  "lab-report": "Lab report",
  "group-assignment": "Group assignment",
  "final-lab-report": "Final lab report",
  presentation: "Presentation",
};

/** The maker's page for a template: the assignment's is the maker's home. */
export const coverPagePath = (template: CoverPageTemplate) =>
  template === "assignment" ? "/cover-page" : `/cover-page/${template}`;

/** The heading printed on each template's page. */
const TITLES: Record<CoverPageTemplate, string> = {
  assignment: "ASSIGNMENT",
  "lab-report": "LAB REPORT",
  "group-assignment": "GROUP ASSIGNMENT",
  "final-lab-report": "FINAL LAB REPORT",
  presentation: "PRESENTATION",
};

export const MAX_COVER_PAGE_MEMBERS = 6;

/** Every text field, with its longest allowed value. */
export const COVER_PAGE_FIELDS = {
  courseCode: 20,
  courseTitle: 120,
  topic: 160,
  experimentNo: 10,
  experimentName: 160,
  teacherName: 80,
  teacherDesignation: 80,
  teacherDepartment: 80,
  studentName: 80,
  studentId: 20,
  section: 20,
  semester: 20,
  studentDepartment: 80,
  date: 20,
} as const;
export type CoverPageField = keyof typeof COVER_PAGE_FIELDS;

export const MAX_COVER_PAGE_MEMBER_NAME = 80;
export const MAX_COVER_PAGE_MEMBER_ID = 20;

export type CoverPageMember = { name: string; id: string };

/** What a cover page is made from: any field may be empty. */
export type CoverPageValues = Partial<Record<CoverPageField, string>> & {
  members?: CoverPageMember[];
};

const TEACHER: CoverPageField[] = [
  "teacherName",
  "teacherDesignation",
  "teacherDepartment",
];
const STUDENT: CoverPageField[] = [
  "studentName",
  "studentId",
  "section",
  "semester",
  "studentDepartment",
];

/** The fields each template uses, in the order the form asks for them. */
export const COVER_PAGE_TEMPLATE_FIELDS: Record<
  CoverPageTemplate,
  CoverPageField[]
> = {
  assignment: [
    "courseCode",
    "courseTitle",
    "topic",
    ...TEACHER,
    ...STUDENT,
    "date",
  ],
  "lab-report": [
    "courseCode",
    "courseTitle",
    "experimentNo",
    "experimentName",
    ...TEACHER,
    ...STUDENT,
    "date",
  ],
  "group-assignment": [
    "courseCode",
    "courseTitle",
    "topic",
    ...TEACHER,
    "section",
    "semester",
    "studentDepartment",
    "date",
  ],
  "final-lab-report": [
    "courseCode",
    "courseTitle",
    ...TEACHER,
    ...STUDENT,
    "date",
  ],
  presentation: [
    "courseCode",
    "courseTitle",
    "topic",
    ...TEACHER,
    ...STUDENT,
    "date",
  ],
};

/** Whether a template has a group's members instead of one student. */
export const isGroupTemplate = (template: CoverPageTemplate) =>
  template === "group-assignment";

export const UNIVERSITY = "Daffodil International University";

/** DIU's terms run Spring (Jan–Apr), Summer (May–Aug) and Fall (Sep–Dec). */
export function semesterOn(date: Date): string {
  const [year, month] = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "numeric",
    timeZone: "Asia/Dhaka",
  })
    .format(date)
    .split("-")
    .map(Number) as [number, number];
  const term = month <= 4 ? "Spring" : month <= 8 ? "Summer" : "Fall";
  return `${term} ${year}`;
}

/** A date as DIU's forms write it, dd/mm/yyyy, in Dhaka. */
export function dhakaDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  }).format(date);
}

// ── Text measurement ─────────────────────────────────────────────────────────

/**
 * Helvetica's advance widths (per 1000 units of size) for ASCII 32–126, from
 * pdf-lib's standard font metrics, so the preview wraps lines where the PDF does.
 */
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584,
  584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
  278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222,
  500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
  500, 334, 260, 334, 584,
];
const HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584,
  584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333,
  278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278,
  556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556,
  500, 389, 280, 389, 584,
];

const SMART: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  "…": "...",
  " ": " ",
};

/**
 * What the page can print: the standard PDF fonts draw only Latin text, so curly
 * quotes and dashes become plain ones and anything else (Bangla, emoji) a "?".
 */
export function printableText(text: string): string {
  return text
    .replace(
      /[\u2018\u2019\u201C\u201D\u2013\u2014\u2026\u00A0]/g,
      (c) => SMART[c]!,
    )
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7E]/g, "?")
    .trim();
}

/** The width of printable text in Helvetica at a size, in points. */
export function textWidth(text: string, size: number, bold = false): number {
  const table = bold ? HELVETICA_BOLD : HELVETICA;
  let units = 0;
  for (const ch of text) units += table[ch.charCodeAt(0) - 32] ?? 556;
  return (units * size) / 1000;
}

/** Breaks printable text into lines no wider than `width`, splitting long words. */
export function wrapLines(
  text: string,
  size: number,
  bold: boolean,
  width: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, size, bold) <= width) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    // A word too long for a line on its own is cut.
    while (textWidth(line, size, bold) > width && line.length > 1) {
      let cut = line.length - 1;
      while (cut > 1 && textWidth(line.slice(0, cut), size, bold) > width)
        cut--;
      lines.push(line.slice(0, cut));
      line = line.slice(cut);
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ── Layout ───────────────────────────────────────────────────────────────────

/** A4 in points; the layout's y grows downwards from the top edge. */
export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;

export type CoverPageColor = "ink" | "navy";
export const COVER_PAGE_COLORS: Record<CoverPageColor, string> = {
  ink: "#111111",
  navy: "#1f3a68",
};

/** One thing drawn on the page. Text's `y` is its baseline. */
export type CoverPageItem =
  | {
      kind: "text";
      x: number;
      y: number;
      text: string;
      size: number;
      bold: boolean;
      color: CoverPageColor;
    }
  | {
      kind: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      width: number;
      color: CoverPageColor;
    }
  | {
      kind: "image";
      image: CoverPageImage;
      x: number;
      y: number;
      w: number;
      h: number;
      opacity: number;
    }
  | {
      kind: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      radius: number;
      width: number;
      color: CoverPageColor;
    };

/**
 * DIU's logo and crest, from DIU's website: the website serves them from
 * `/cover-page/<file>`, the API embeds the same files (`services/cover-page/images.ts`).
 */
export type CoverPageImage = "logo" | "crest";
export const COVER_PAGE_IMAGES: Record<
  CoverPageImage,
  { file: string; width: number; height: number }
> = {
  logo: { file: "diu-logo.png", width: 1000, height: 265 },
  crest: { file: "diu-crest.png", width: 245, height: 241 },
};

const MARGIN = 72;
const CONTENT = A4_WIDTH - 2 * MARGIN;
const COLUMN_GAP = 24;
const COLUMN = (CONTENT - COLUMN_GAP) / 2;

/** Builds the page: every item at its place, empty fields left blank. */
export function coverPageLayout(
  template: CoverPageTemplate,
  values: CoverPageValues,
): CoverPageItem[] {
  const items: CoverPageItem[] = [];
  const value = (field: CoverPageField) => printableText(values[field] ?? "");

  const text = (
    x: number,
    y: number,
    t: string,
    size: number,
    bold: boolean,
    color: CoverPageColor = "ink",
  ) => items.push({ kind: "text", x, y, text: t, size, bold, color });

  const centred = (
    y: number,
    t: string,
    size: number,
    bold: boolean,
    color: CoverPageColor = "ink",
  ) => {
    const w = textWidth(t, size, bold);
    text((A4_WIDTH - w) / 2, y, t, size, bold, color);
    return w;
  };

  const underline = (x: number, y: number, w: number, color: CoverPageColor) =>
    items.push({
      kind: "line",
      x1: x,
      y1: y + 2,
      x2: x + w,
      y2: y + 2,
      width: 0.8,
      color,
    });

  /**
   * "Label: value" from `x`, wrapping the value under itself, at most `maxLines`
   * lines. Returns the y below it.
   */
  const labelled = (
    x: number,
    y: number,
    width: number,
    label: string,
    v: string,
    size: number,
    lineHeight: number,
    maxLines = 2,
  ) => {
    const head = `${label}: `;
    const headWidth = textWidth(head, size, true);
    text(x, y, head, size, true);
    const lines = v ? wrapLines(v, size, false, width - headWidth) : [];
    lines
      .slice(0, maxLines)
      .forEach((line, i) =>
        text(x + headWidth, y + i * lineHeight, line, size, false),
      );
    return y + Math.max(1, Math.min(lines.length, maxLines)) * lineHeight;
  };

  /** A bold line (a department, the university), wrapped. */
  const bold = (
    x: number,
    y: number,
    width: number,
    t: string,
    size: number,
    lineHeight: number,
  ) => {
    if (!t) return y;
    const lines = wrapLines(t, size, true, width).slice(0, 2);
    lines.forEach((line, i) => text(x, y + i * lineHeight, line, size, true));
    return y + lines.length * lineHeight;
  };

  // The frame.
  items.push({
    kind: "rect",
    x: 22,
    y: 22,
    w: A4_WIDTH - 44,
    h: A4_HEIGHT - 44,
    radius: 0,
    width: 1,
    color: "ink",
  });

  // DIU's logo, its crest faintly behind the middle of the page, then the
  // template's heading.
  const image = (
    name: CoverPageImage,
    y: number,
    w: number,
    opacity: number,
  ) => {
    const { width, height } = COVER_PAGE_IMAGES[name];
    const h = (w * height) / width;
    items.push({
      kind: "image",
      image: name,
      x: (A4_WIDTH - w) / 2,
      y,
      w,
      h,
      opacity,
    });
  };
  image("logo", 58, 260, 1);
  image("crest", 300, 230, 0.12);
  const title = TITLES[template];
  const titleWidth = centred(186, title, 16, true, "navy");
  underline((A4_WIDTH - titleWidth) / 2, 186, titleWidth, "navy");

  // The course and the work.
  let y = 232;
  const detail = (label: string, v: string) => {
    y = labelled(MARGIN, y, CONTENT, label, v, 14, 21) + 6;
  };
  detail("Course Code", value("courseCode"));
  detail("Course Title", value("courseTitle"));
  if (template === "lab-report") {
    detail("Experiment No", value("experimentNo"));
    detail("Experiment Name", value("experimentName"));
  } else if (template !== "final-lab-report") {
    detail("Topic Name", value("topic"));
  }

  // Submitted to and submitted by, side by side near the foot.
  const SIZE = 11;
  const LINE = 16;
  const top = isGroupTemplate(template) ? 520 : 570;
  const heading = (x: number, t: string) => {
    text(x, top, t, 12.5, true, "navy");
    underline(x, top, textWidth(t, 12.5, true), "navy");
  };

  const left = MARGIN;
  heading(left, "Submitted To");
  let ly = top + 24;
  ly = labelled(left, ly, COLUMN, "Name", value("teacherName"), SIZE, LINE);
  ly = labelled(
    left,
    ly,
    COLUMN,
    "Designation",
    value("teacherDesignation"),
    SIZE,
    LINE,
  );
  ly = bold(left, ly, COLUMN, value("teacherDepartment"), SIZE, LINE);
  bold(left, ly, COLUMN, UNIVERSITY, SIZE, LINE);

  const right = MARGIN + COLUMN + COLUMN_GAP;
  heading(right, "Submitted By");
  let ry = top + 24;
  if (isGroupTemplate(template)) {
    const members = (values.members ?? [])
      .slice(0, MAX_COVER_PAGE_MEMBERS)
      .map((m) => ({ name: printableText(m.name), id: printableText(m.id) }))
      .filter((m) => m.name || m.id);
    for (const m of members) {
      const idWidth = m.id ? textWidth(m.id, SIZE, true) : 0;
      text(
        right,
        ry,
        wrapLines(m.name, SIZE, false, COLUMN - idWidth - 8)[0] ?? "",
        SIZE,
        false,
      );
      if (m.id) text(right + COLUMN - idWidth, ry, m.id, SIZE, true);
      ry += LINE;
    }
    if (members.length) ry += 4;
  } else {
    ry = labelled(right, ry, COLUMN, "Name", value("studentName"), SIZE, LINE);
    ry = labelled(right, ry, COLUMN, "ID", value("studentId"), SIZE, LINE, 1);
  }
  ry = labelled(right, ry, COLUMN, "Section", value("section"), SIZE, LINE, 1);
  ry = labelled(
    right,
    ry,
    COLUMN,
    "Semester",
    value("semester"),
    SIZE,
    LINE,
    1,
  );
  ry = bold(right, ry, COLUMN, value("studentDepartment"), SIZE, LINE);
  bold(right, ry, COLUMN, UNIVERSITY, SIZE, LINE);

  // The date, in a pill at the foot.
  const date = `Date of Submission: ${value("date")}`;
  const dateWidth = textWidth(date, 12, true);
  const pillWidth = dateWidth + 32;
  items.push({
    kind: "rect",
    x: (A4_WIDTH - pillWidth) / 2,
    y: 762,
    w: pillWidth,
    h: 26,
    radius: 13,
    width: 1.2,
    color: "navy",
  });
  centred(779, date, 12, true, "navy");

  return items;
}
