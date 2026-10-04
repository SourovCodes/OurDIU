import {
  ROUTINE_DAY_NAMES,
  ROUTINE_DAYS,
  routineGroupLabel,
  routineTimeRange,
  type RoutineDay,
  type RoutineSection,
  type RoutineTeacherWeek,
  type RoutineVersion,
} from "@ourdiu/shared";
import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  rgb,
  StandardFonts,
} from "pdf-lib";
import qrcode from "qrcode-generator";

// A section's (or a teacher's) week as a one-page A4 PDF (docs/PLAN.md, Phase 3): the columns of the
// routine PDFs students already share (day, course, time, room, teacher), with the
// version, the lab group and a QR code to the live page, so a printed copy leads
// to the latest routine. OurDIU's name only: it isn't an official DIU document.

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 40;
const TEAL = rgb(0, 0x6b / 255, 0x5b / 255);
const INK = rgb(0x1c / 255, 0x1b / 255, 0x23 / 255);
const MUTED = rgb(0x5b / 255, 0x58 / 255, 0x6c / 255);
const RULE = rgb(0xd9 / 255, 0xd5 / 255, 0xe3 / 255);
const BAND = rgb(0xee / 255, 0xf8 / 255, 0xf5 / 255);
const WHITE = rgb(1, 1, 1);

/** Column left edges and widths: day, course, time, room, teacher (or sections). */
const COLUMNS = [
  { title: "Day", x: MARGIN, width: 70 },
  { title: "Course", x: MARGIN + 70, width: 214 },
  { title: "Time", x: MARGIN + 284, width: 104 },
  { title: "Room", x: MARGIN + 388, width: 70 },
  { title: "Teacher", x: MARGIN + 458, width: A4.width - 2 * MARGIN - 458 },
] as const;
const PAD = 6;
const ROW = 32;
const EMPTY_ROW = 22;
const FOOTER_SPACE = 64;

/** Standard PDF fonts only draw Latin-1 (WinAnsi); anything else becomes "?". */
const printable = (text: string) =>
  text.replace(
    /[^\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026]/g,
    "?",
  );

function fit(text: string, font: PDFFont, size: number, width: number) {
  let t = printable(text);
  if (font.widthOfTextAtSize(t, size) <= width) return t;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > width) {
    t = t.slice(0, -1);
  }
  return `${t.trimEnd()}…`;
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of printable(text).split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

const formatDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export type RoutinePdfInput = {
  routine: RoutineSection;
  /** Only this lab group's labs; null for the whole section. */
  group: string | null;
  /** The section's page on the site, for the QR code. */
  pageUrl: string;
  /** The day it's downloaded, "2026-10-04" (Dhaka time). */
  today: string;
};

/** The classes a lab group (or the whole section) has. */
export function classesFor(routine: RoutineSection, group: string | null) {
  return routine.classes.filter(
    (c) => !group || !c.labGroup || c.labGroup === group,
  );
}

/** "67_B1_routine_v4.1.pdf" */
export function routinePdfFilename(
  routine: RoutineSection,
  group: string | null,
) {
  const name = group
    ? routineGroupLabel(routine.section, group)
    : routine.section;
  return `${name.replace(/[^A-Za-z0-9_.-]+/g, "_")}_routine_v${routine.version.version}.pdf`;
}

/** A row of the table: one class. */
type PdfRow = {
  day: RoutineDay;
  title: string;
  /** Under the title: the code and who attends. */
  detail: string;
  start: string;
  end: string;
  room: string;
  lab: boolean;
  /** The last column: the teacher's initials, or the sections. */
  who: string | null;
};

type WeekPdfInput = {
  version: RoutineVersion;
  /** Whose week: "67_B1", "STA". */
  label: string;
  /** Under the heading, before the class count: the lab groups, the teacher's name. */
  meta: (string | null)[];
  /** The last column's heading. */
  who: string;
  rows: PdfRow[];
  pageUrl: string;
  today: string;
};

export async function routinePdf({
  routine,
  group,
  pageUrl,
  today,
}: RoutinePdfInput): Promise<Uint8Array> {
  const label = group
    ? routineGroupLabel(routine.section, group)
    : routine.section;
  return weekPdf({
    version: routine.version,
    label,
    meta: [
      group
        ? `Lab group ${group}`
        : routine.labGroups.length
          ? `Both lab groups (${routine.labGroups.join(", ")})`
          : null,
    ],
    who: "Teacher",
    rows: classesFor(routine, group).map((c) => ({
      day: c.day,
      title: c.course.title ?? c.course.code,
      detail: [
        c.course.code,
        c.labGroup
          ? routineGroupLabel(routine.section, c.labGroup)
          : routine.section,
      ].join("  ·  "),
      start: c.start,
      end: c.end,
      room: c.room,
      lab: c.roomType === "lab",
      who: c.teacher?.initials ?? null,
    })),
    pageUrl,
    today,
  });
}

/** Who attends a teacher's class, as students write them: "67_B1, 67_C". */
export const attendingLabel = (
  sections: RoutineTeacherWeek["classes"][number]["sections"],
) =>
  sections
    .map((s) =>
      s.labGroup ? routineGroupLabel(s.section, s.labGroup) : s.section,
    )
    .join(", ");

/** "STA_routine_v4.1.pdf" */
export function teacherPdfFilename(week: RoutineTeacherWeek) {
  return `${week.teacher.initials.replace(/[^A-Za-z0-9_.-]+/g, "_")}_routine_v${week.version.version}.pdf`;
}

/** A teacher's week: the sections they teach where a section's PDF has the teacher. */
export async function teacherRoutinePdf({
  week,
  pageUrl,
  today,
}: {
  week: RoutineTeacherWeek;
  pageUrl: string;
  today: string;
}): Promise<Uint8Array> {
  return weekPdf({
    version: week.version,
    label: week.teacher.initials,
    meta: [
      week.teacher.name,
      week.teacher.room ? `Sits in ${week.teacher.room}` : null,
    ],
    who: "Section",
    rows: week.classes.map((c) => ({
      day: c.day,
      title: c.course.title ?? c.course.code,
      detail: c.course.title ? c.course.code : "",
      start: c.start,
      end: c.end,
      room: c.room,
      lab: c.roomType === "lab",
      who: attendingLabel(c.sections),
    })),
    pageUrl,
    today,
  });
}

async function weekPdf({
  version,
  label,
  meta: extra,
  who,
  rows: classes,
  pageUrl,
  today,
}: WeekPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Class schedule: ${label}`);
  doc.setAuthor("OurDIU");
  doc.setSubject(
    `${version.department} class routine v${version.version}, ${label}`,
  );
  doc.setCreator("OurDIU (ourdiu.com)");

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const days = ROUTINE_DAYS.filter(
    (d) => d !== "FRI" || classes.some((c) => c.day === "FRI"),
  );

  let page: PDFPage = doc.addPage([A4.width, A4.height]);
  let y = A4.height - MARGIN;

  // ── Header ──
  page.drawRectangle({
    x: MARGIN,
    y: y - 26,
    width: 26,
    height: 26,
    color: TEAL,
  });
  page.drawText("O", {
    x: MARGIN + 7.5,
    y: y - 18.5,
    size: 14,
    font: bold,
    color: WHITE,
  });
  page.drawText("OurDIU", {
    x: MARGIN + 34,
    y: y - 12,
    size: 15,
    font: bold,
    color: INK,
  });
  page.drawText("Class Routine", {
    x: MARGIN + 34,
    y: y - 24,
    size: 9,
    font: regular,
    color: MUTED,
  });

  const qr = qrcode(0, "M");
  qr.addData(pageUrl);
  qr.make();
  const modules = qr.getModuleCount();
  const qrSize = 66;
  const cell = qrSize / modules;
  const qrX = A4.width - MARGIN - qrSize;
  const qrTop = y;
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if (qr.isDark(r, c)) {
        page.drawRectangle({
          x: qrX + c * cell,
          y: qrTop - (r + 1) * cell,
          width: cell + 0.05,
          height: cell + 0.05,
          color: INK,
        });
      }
    }
  }
  const shownUrl = printable(pageUrl.replace(/^https?:\/\//, ""));
  const urlSize = 7;
  page.drawText(shownUrl, {
    x: A4.width - MARGIN - regular.widthOfTextAtSize(shownUrl, urlSize),
    y: qrTop - qrSize - 10,
    size: urlSize,
    font: regular,
    color: MUTED,
  });

  y -= 104;
  page.drawText(
    fit(`Class schedule: ${label}`, bold, 24, A4.width - 2 * MARGIN),
    {
      x: MARGIN,
      y,
      size: 24,
      font: bold,
      color: INK,
    },
  );
  y -= 20;
  const meta = [
    `${version.department} class routine v${version.version}`,
    version.publishedOn ? `published ${formatDate(version.publishedOn)}` : null,
    ...extra,
    `${classes.length} class${classes.length === 1 ? "" : "es"} a week`,
  ].filter(Boolean);
  page.drawText(printable(meta.join("  ·  ")), {
    x: MARGIN,
    y,
    size: 10,
    font: regular,
    color: MUTED,
  });
  y -= 22;

  // ── Table ──
  const tableWidth = A4.width - 2 * MARGIN;
  const drawHead = () => {
    page.drawRectangle({
      x: MARGIN,
      y: y - 22,
      width: tableWidth,
      height: 22,
      color: TEAL,
    });
    for (const col of COLUMNS) {
      page.drawText(col === COLUMNS[4] ? who : col.title, {
        x: col.x + PAD,
        y: y - 15,
        size: 10,
        font: bold,
        color: WHITE,
      });
    }
    y -= 22;
  };
  const footer = (p: PDFPage) => {
    const top = MARGIN + 26;
    p.drawLine({
      start: { x: MARGIN, y: top },
      end: { x: A4.width - MARGIN, y: top },
      thickness: 0.6,
      color: RULE,
    });
    const note = `Made by OurDIU from the ${version.department} class routine v${version.version} published by Daffodil International University. Routines change during the semester: scan the code for the latest.`;
    wrap(note, regular, 7.5, 390).forEach((line, i) => {
      p.drawText(line, {
        x: MARGIN,
        y: top - 11 - i * 9.5,
        size: 7.5,
        font: regular,
        color: MUTED,
      });
    });
    const when = `Downloaded ${formatDate(today)}`;
    p.drawText(when, {
      x: A4.width - MARGIN - regular.widthOfTextAtSize(when, 7.5),
      y: top - 11,
      size: 7.5,
      font: regular,
      color: MUTED,
    });
  };
  const newPage = () => {
    footer(page);
    page = doc.addPage([A4.width, A4.height]);
    y = A4.height - MARGIN;
    drawHead();
  };
  drawHead();

  const cellText = (
    text: string,
    col: (typeof COLUMNS)[number],
    top: number,
    opts: {
      font?: PDFFont;
      size?: number;
      color?: typeof INK;
      line?: 1 | 2;
    } = {},
  ) => {
    const size = opts.size ?? (opts.line === 2 ? 8 : 9.5);
    const font = opts.font ?? regular;
    page.drawText(fit(text, font, size, col.width - 2 * PAD), {
      x: col.x + PAD,
      y: top - (opts.line === 2 ? 25 : 13),
      size,
      font,
      color: opts.color ?? (opts.line === 2 ? MUTED : INK),
    });
  };
  const [dayCol, courseCol, timeCol, roomCol, teacherCol] = COLUMNS;

  const drawClass = (c: PdfRow, top: number) => {
    cellText(c.title, courseCol, top, { font: bold });
    if (c.detail) cellText(c.detail, courseCol, top, { line: 2 });
    cellText(routineTimeRange(c.start, c.end), timeCol, top);
    cellText(c.room, roomCol, top);
    if (c.lab) cellText("Lab", roomCol, top, { line: 2 });
    if (c.who) cellText(c.who, teacherCol, top);
  };

  for (const day of days) {
    const dayName = ROUTINE_DAY_NAMES[ROUTINE_DAYS.indexOf(day)]!;
    const onDay = classes.filter((c) => c.day === day);
    const height = onDay.length ? onDay.length * ROW : EMPTY_ROW;
    if (y - Math.min(height, ROW) < MARGIN + FOOTER_SPACE) newPage();
    // A day's rows stay together when they fit on a page.
    if (y - height < MARGIN + FOOTER_SPACE && height < A4.height / 2) newPage();

    const dayTop = y;
    const bandHeight = Math.min(height, y - MARGIN - FOOTER_SPACE);
    page.drawRectangle({
      x: dayCol.x,
      y: dayTop - bandHeight,
      width: dayCol.width,
      height: bandHeight,
      color: BAND,
    });
    page.drawText(dayName, {
      x: dayCol.x + PAD,
      y: dayTop - 13,
      size: 9.5,
      font: bold,
      color: INK,
    });

    if (!onDay.length) {
      page.drawText("No classes", {
        x: courseCol.x + PAD,
        y: y - 14,
        size: 9.5,
        font: italic,
        color: MUTED,
      });
      y -= EMPTY_ROW;
    } else {
      onDay.forEach((c, i) => {
        if (y - ROW < MARGIN + FOOTER_SPACE) {
          newPage();
          page.drawRectangle({
            x: dayCol.x,
            y: y - ROW,
            width: dayCol.width,
            height: ROW,
            color: BAND,
          });
          page.drawText(dayName, {
            x: dayCol.x + PAD,
            y: y - 13,
            size: 9.5,
            font: bold,
            color: INK,
          });
        } else if (i > 0) {
          page.drawLine({
            start: { x: courseCol.x, y },
            end: { x: A4.width - MARGIN, y },
            thickness: 0.5,
            color: RULE,
          });
        }
        drawClass(c, y);
        y -= ROW;
      });
    }
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: A4.width - MARGIN, y },
      thickness: 0.8,
      color: RULE,
    });
  }
  footer(page);

  return doc.save();
}
