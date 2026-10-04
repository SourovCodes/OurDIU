import {
  PDFDocument,
  StandardFonts,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

// A small routine PDF laid out like EEE's (fall 2026, version 4.0): a page per day,
// each a grid of rooms by one-hour slots with the labs under a second header, then
// the teachers' list. The classes and teachers are made up.

/** Where each slot's cell starts, its "L-T-S" column; the break comes after the 4th. */
const COLUMNS = [60, 137, 215, 295, 407, 490, 567, 643, 716];
const TIMES = [
  "8:30-9:30",
  "9:30-10:30",
  "10:30-11:30",
  "11:30-12:30",
  "1:00-2:00",
  "2:00-3:00",
  "3:00-4:00",
  "4:00-5:00",
  "5:00-6:00",
];

/** A cell: its lines of "L-T-S" and of course, and the teacher's initials. */
type Cell = {
  slot: number;
  sections: string[];
  courses: string[];
  ti?: string;
};
type Row = { room: string[]; y: number; cells: Cell[] };

function writer(page: PDFPage, font: PDFFont) {
  return (text: string, x: number, y: number) =>
    page.drawText(text, { x, y, size: 6, font });
}

function header(
  write: ReturnType<typeof writer>,
  day: string,
  version: string,
) {
  write("Daffodil International University", 337, 547);
  write("Department of Electrical and Electronic Engineering", 329, 539);
  write("Class Routine - Fall 2026", 367, 516);
  write(`Version ${version}`, 336, 509);
  write("Effective from October 03, 2026", 379, 509);
  write(day, 405, 498);
}

/** A grid's header: the times, then "L-T-S Course TI" under each slot. */
function gridHeader(
  write: ReturnType<typeof writer>,
  first: "Room" | "Lab",
  y: number,
) {
  write(first, 33, y);
  TIMES.forEach((time, i) => write(time, COLUMNS[i]! + 22, y));
  write("12:30-1:00", 372, y);
  if (first === "Lab") write("Room", 33, y - 11);
  for (const x of COLUMNS) {
    write("L-T-S", x, y - 11 - (first === "Lab" ? 0 : 3));
    write("Course", x + 26, y - 11 - (first === "Lab" ? 0 : 3));
    write("TI", x + 62, y - 11 - (first === "Lab" ? 0 : 3));
  }
}

function rows(write: ReturnType<typeof writer>, list: Row[]) {
  for (const row of list) {
    // A room's name over several lines is centred on its row.
    row.room.forEach((line, i) =>
      write(line, 33, row.y + ((row.room.length - 1) / 2 - i) * 8),
    );
    for (const cell of row.cells) {
      const x = COLUMNS[cell.slot]!;
      const lines = Math.max(cell.sections.length, cell.courses.length);
      const lineY = (i: number) => row.y + ((lines - 1) / 2 - i) * 8;
      cell.sections.forEach((s, i) => write(s, x + 1, lineY(i)));
      cell.courses.forEach((c, i) => write(c, x + 21, lineY(i)));
      if (cell.ti) write(cell.ti, x + 60, row.y);
    }
  }
}

/** Two cells in a row with the same class: a lab of two hours. */
const twice = (cell: Omit<Cell, "slot">, slot: number): Cell[] => [
  { ...cell, slot },
  { ...cell, slot: slot + 1 },
];

export async function eeeRoutinePdf(version = "4.0"): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  // Saturday: classrooms 301 and 103, labs 105, 106 and a chemistry lab.
  const saturday = doc.addPage([792, 612]);
  const sat = writer(saturday, font);
  header(sat, "Saturday", version);
  sat("Theory", 32, 498);
  gridHeader(sat, "Room", 487);
  rows(sat, [
    {
      room: ["301"],
      y: 461,
      cells: [
        { slot: 0, sections: ["1-2 B"], courses: ["0713-121 B"], ti: "MW" },
        { slot: 1, sections: ["1-2 B"], courses: ["0531-121 B"], ti: "AAA" },
        // The section's letter disagrees with the course's.
        { slot: 4, sections: ["1-3 A"], courses: ["0541-131 B"], ti: "IJM" },
      ],
    },
    {
      // A double class two sections share, a line each.
      room: ["103"],
      y: 440,
      cells: twice(
        {
          sections: ["1-2 A", "1-2 E1"],
          courses: ["0713-121 A", "0713-121 E1"],
          ti: "MSA",
        },
        0,
      ),
    },
  ]);
  sat("BreakBreak", 375, 420);
  gridHeader(sat, "Lab", 301);
  rows(sat, [
    {
      room: ["105"],
      y: 279,
      cells: twice(
        { sections: ["1-2 B"], courses: ["0713-122 B1"], ti: "BS" },
        2,
      ),
    },
    {
      room: ["106"],
      y: 268,
      cells: [
        // A lab's second cell without its lab group.
        { slot: 4, sections: ["3-3 A"], courses: ["0714-322 A2"], ti: "RS" },
        { slot: 5, sections: ["3-3 A"], courses: ["0714-322"], ti: "RS" },
      ],
    },
    {
      room: ["Civil-A", "(303)", "Chemistry", "Lab"],
      y: 244,
      cells: [
        // The course's section wrapped onto the next line.
        {
          slot: 0,
          sections: ["1-2 D"],
          courses: ["0531-122", "D2"],
          ti: "ShA",
        },
      ],
    },
  ]);
  // A cell's parts as one piece of text.
  sat("2-2 C 0714-222 C2", 216, 268);
  sat("DTF", 277, 268);

  // Sunday: one class.
  const sunday = doc.addPage([792, 612]);
  const sun = writer(sunday, font);
  header(sun, "Sunday", version);
  gridHeader(sun, "Room", 487);
  rows(sun, [
    {
      room: ["301"],
      y: 461,
      cells: [
        { slot: 5, sections: ["4-2 A"], courses: ["0713-421 A"], ti: "DAM" },
      ],
    },
  ]);
  sun("Departmental", 60, 440);
  sun("Meeting", 60, 432);

  // The teachers, with contacts that aren't read.
  const teachersPage = doc.addPage([792, 612]);
  const tw = writer(teachersPage, font);
  tw("Daffodil International University", 337, 547);
  tw("Course Teachers' Information - Fall'26", 340, 531);
  tw("Name", 120, 510);
  tw("Initial", 300, 510);
  tw("Contact No.", 360, 510);
  tw("Email", 470, 510);
  [
    ["Dr. Test Alam", "MSA"],
    ["Test Wahid", "MW"],
    ["Anan Test Azad", "AAA"],
    ["Bijoy Test", "BS"],
    ["Dr. Md. Shahin Test", "ShA"],
  ].forEach(([name, initials], i) => {
    const y = 498 - i * 10;
    tw(name!, 100, y);
    tw(initials!, 302, y);
    tw("01700000000", 360, y);
    tw(`${initials!.toLowerCase()}@example.com`, 450, y);
  });

  return doc.save();
}
