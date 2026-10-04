import {
  PDFDocument,
  StandardFonts,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

// A routine laid out like CSE's PDF (v4.1): the days one after another, each starting
// wherever the last ended ("SUNDAY") and going on over the next page; per slot a
// cell of room, course with its section and teacher, the room again in every cell
// and a lab's over two lines ("G1-017" over "(COM LAB)"). For tests: any routine
// given as classes is drawn so CSE's reader can read it back.

type Slot = { start: string; end: string };
type Class = {
  day: string;
  start: string;
  end: string;
  course: string;
  section: string;
  labGroup?: string | null;
  room: string;
  roomType?: "lab" | null;
  teacher?: string | null;
};

const DAYS: Record<string, string> = {
  SAT: "SATURDAY",
  SUN: "SUNDAY",
  MON: "MONDAY",
  TUE: "TUESDAY",
  WED: "WEDNESDAY",
  THU: "THURSDAY",
  FRI: "FRIDAY",
};
const PAGE: [number, number] = [1191.12, 842.88];
/** Course texts longer than this wrap: "CSE325(RE_A(3C)(D" over "MML))". */
const WRAP = 17;
/** Each slot's "Room" column; "Course" and "Teacher" follow. */
const roomX = (i: number) => 36 + 193.5 * i;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "01:00" for 13:00, as CSE's PDF writes times. */
const twelve = (time: string) => {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return `${String(h > 12 ? h - 12 : h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/** "CSE322(67_B1)": the section with the lab group's number. */
function courseText(c: Class) {
  const group =
    c.labGroup && c.section.endsWith(`_${c.labGroup[0]}`)
      ? c.labGroup.slice(1)
      : (c.labGroup ?? "");
  return `${c.course}(${c.section}${group})`;
}

/**
 * The PDF's bytes, the same each time it's made: pdf-lib stamps the current time,
 * so a test comparing a stored PDF with a fresh one fails across a second.
 */
export function savedSameEachTime(doc: PDFDocument) {
  const fixed = new Date("2026-10-02T00:00:00Z");
  doc.setCreationDate(fixed);
  doc.setModificationDate(fixed);
  return doc.save();
}

export async function cseRoutinePdf(routine: {
  version: string;
  publishedOn?: string | null;
  slots: Slot[];
  classes: Class[];
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let page: PDFPage = doc.addPage(PAGE);
  let y = 819;
  const write = (text: string, x: number, at: number, on = page) =>
    on.drawText(text, { x, y: at, size: 7, font: font as PDFFont });
  const room = (needed: number) => {
    if (y - needed < 30) {
      page = doc.addPage(PAGE);
      y = 815;
    }
  };

  write("Class Routine for CSE Program", 535, y);
  write(`Version V${routine.version}`, 571, (y -= 13));
  if (routine.publishedOn) {
    const [year, month, day] = routine.publishedOn.split("-");
    write(
      `Effective From: ${day} ${MONTHS[Number(month) - 1]}, ${year}`,
      198,
      (y -= 13),
    );
  }
  write("Prepared by: Class Routine Committee, Dept. of CSE", 793, y);
  y -= 13;

  for (const [code, name] of Object.entries(DAYS)) {
    const classes = routine.classes.filter((c) => c.day === code);
    if (!classes.length) continue;
    room(60);
    write(name, 574, y);
    y -= 13;
    routine.slots.forEach((s, i) =>
      write(`${twelve(s.start)}-${twelve(s.end)}`, roomX(i) + 53, y),
    );
    y -= 13;
    routine.slots.forEach((_, i) => {
      write("Room", roomX(i), y);
      write("Course", roomX(i) + 76, y);
      write("Teacher", roomX(i) + 138, y);
    });
    y -= 13;

    const rooms = [...new Set(classes.map((c) => c.room))].sort();
    for (const name of rooms) {
      const inRoom = classes.filter((c) => c.room === name);
      const lab = inRoom.some((c) => c.roomType === "lab");
      // A course too long for its cell goes on over the next line, the row taller.
      const tall = lab || inRoom.some((c) => courseText(c).length > WRAP);
      room(tall ? 24 : 13);
      routine.slots.forEach((s, i) => {
        // A room's name stands in every cell; a lab's over two lines, the course
        // between them.
        write(name, roomX(i) - 2, lab ? y + 5 : y);
        if (lab) write("(COM LAB)", roomX(i) - 9, y - 5);
        const c = inRoom.find((c) => c.start <= s.start && c.end >= s.end);
        if (!c) return;
        const text = courseText(c);
        if (text.length > WRAP) {
          write(text.slice(0, WRAP), roomX(i) + 60, y + 5);
          write(text.slice(WRAP), roomX(i) + 80, y - 5);
        } else write(text, roomX(i) + 60, y);
        if (c.teacher) write(c.teacher, roomX(i) + 141, y);
      });
      y -= tall ? 24 : 13;
    }
  }
  return savedSameEachTime(doc);
}

/** A one-line PDF, e.g. another department's routine that no reader knows. */
export async function onePagePdf(text: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage().drawText(text);
  return savedSameEachTime(doc);
}
