import type { RoutineFile } from "@ourdiu/shared";
import {
  MAX_ROUTINE_CLASSES,
  ROUTINE_DAYS,
  ROUTINE_DEPARTMENTS,
  ROUTINE_FILE_FORMAT,
} from "@ourdiu/shared/constants";

// The routine file's format, as the admin page explains it. The upload is checked
// against `routineFileSchema` (packages/shared); keep these words in step with it.

/** Section 67_B of the CSE routine v4.1, as a complete routine file. */
export const ROUTINE_EXAMPLE: RoutineFile = {
  format: ROUTINE_FILE_FORMAT,
  department: "CSE",
  version: "4.1",
  publishedOn: "2026-10-02",
  source:
    "https://webbackend.daffodilvarsity.edu.bd/noticeFile/cse-class-routine-v41.pdf",
  slots: [
    { start: "08:30", end: "10:00" },
    { start: "10:00", end: "11:30" },
    { start: "11:30", end: "13:00" },
    { start: "13:00", end: "14:30" },
    { start: "14:30", end: "16:00" },
    { start: "16:00", end: "17:30" },
  ],
  courses: {
    CSE315: "Software Engineering",
    CSE317: "Microprocessor and Microcontrollers",
    CSE321: "Computer Networks",
    CSE322: "Computer Networks Lab",
    ACT327: "Financial and Managerial Accounting",
  },
  teachers: {},
  classes: [
    {
      day: "SAT",
      start: "13:00",
      end: "14:30",
      course: "CSE321",
      section: "67_B",
      room: "KT-222",
      teacher: "STA",
    },
    {
      day: "SAT",
      start: "14:30",
      end: "16:00",
      course: "ACT327",
      section: "67_B",
      room: "KT-318(B)",
      teacher: "IK",
    },
    {
      day: "SUN",
      start: "10:00",
      end: "11:30",
      course: "CSE315",
      section: "67_B",
      room: "KT-213",
      teacher: "AS",
    },
    {
      day: "SUN",
      start: "11:30",
      end: "13:00",
      course: "CSE317",
      section: "67_B",
      room: "KT-501(A)",
      roomType: "lab",
      teacher: "MRR",
    },
    {
      day: "MON",
      start: "08:30",
      end: "11:30",
      course: "CSE322",
      section: "67_B",
      labGroup: "B2",
      room: "G1-017",
      roomType: "lab",
      teacher: "STA",
    },
    {
      day: "MON",
      start: "11:30",
      end: "13:00",
      course: "CSE315",
      section: "67_B",
      room: "KT-208",
      teacher: "AS",
    },
    {
      day: "MON",
      start: "14:30",
      end: "17:30",
      course: "CSE322",
      section: "67_B",
      labGroup: "B1",
      room: "G1-014",
      roomType: "lab",
      teacher: "STA",
    },
    {
      day: "WED",
      start: "11:30",
      end: "13:00",
      course: "ACT327",
      section: "67_B",
      room: "KT-517(A)",
      teacher: "IK",
    },
    {
      day: "WED",
      start: "14:30",
      end: "16:00",
      course: "CSE317",
      section: "67_B",
      room: "KT-518",
      teacher: "MRR",
    },
    {
      day: "WED",
      start: "16:00",
      end: "17:30",
      course: "CSE321",
      section: "67_B",
      room: "KT-514",
      teacher: "STA",
    },
  ],
};

/** Each field and its rule, for the format page and the AI instructions. */
export const ROUTINE_FIELD_RULES: { field: string; rule: string }[] = [
  { field: "format", rule: `Always ${ROUTINE_FILE_FORMAT}.` },
  {
    field: "department",
    rule: `${ROUTINE_DEPARTMENTS.map((d) => `"${d}"`).join(", ")} (the only department for now).`,
  },
  {
    field: "version",
    rule: 'As printed on DIU\'s routine, e.g. "4.1". Each version is uploaded once.',
  },
  {
    field: "publishedOn, source",
    rule: 'Optional: the date DIU published it ("2026-10-02") and the link to its PDF.',
  },
  {
    field: "slots",
    rule: 'The time slots in order, in 24-hour time: { "start": "13:00", "end": "14:30" }.',
  },
  {
    field: "courses",
    rule: 'Optional: course titles by code, { "CSE321": "Computer Networks" }. Titles left out keep the one from an earlier version, or show the code.',
  },
  {
    field: "teachers",
    rule: 'Optional: teachers\' full names by initials, { "STA": "…" }.',
  },
  {
    field: "classes[].day",
    rule: `${ROUTINE_DAYS.join(", ")}.`,
  },
  {
    field: "classes[].start, end",
    rule: 'Slot edges in 24-hour time ("13:00", never "1:00"). A lab over two slots is one class: "08:30" to "11:30".',
  },
  {
    field: "classes[].course",
    rule: 'The course code in capitals without spaces: "CSE321".',
  },
  {
    field: "classes[].section",
    rule: 'Batch and section: "67_B". Retakes as printed: "RE_A(3C)".',
  },
  {
    field: "classes[].labGroup",
    rule: 'Only for a class one lab group attends: "B1" for 67_B1, and section "67_B". Leave it out when the whole section attends.',
  },
  {
    field: "classes[].room",
    rule: 'As printed, without "(COM LAB)": "KT-501(A)".',
  },
  {
    field: "classes[].roomType",
    rule: '"lab" when the routine marks the room as a lab, e.g. "(COM LAB)". Otherwise leave it out.',
  },
  {
    field: "classes[].teacher",
    rule: 'The teacher\'s initials as printed: "STA". Leave it out if there are none.',
  },
];

/**
 * What to paste into an AI chat with DIU's routine PDF to get a file to upload:
 * the rules, the JSON schema and an example.
 */
export function routineAiInstructions(schema: unknown) {
  const example = {
    ...ROUTINE_EXAMPLE,
    classes: ROUTINE_EXAMPLE.classes.slice(3, 7),
  };
  return [
    "Convert the attached class routine PDF of Daffodil International University into one JSON file in the format below. Reply with the JSON only, in one code block.",
    "",
    "Rules:",
    ...ROUTINE_FIELD_RULES.map((r) => `- ${r.field}: ${r.rule}`),
    `- Include every class of every section on every day (at most ${MAX_ROUTINE_CLASSES}). Skip empty cells.`,
    '- Each cell of the routine is one class: a course code with its section in brackets, e.g. "CSE321(67_B)", a room and a teacher\'s initials. "CSE322(67_B1)" is section 67_B with labGroup B1.',
    "- Copy codes, rooms and initials exactly; don't guess what isn't printed. Leave courses and teachers empty if the PDF has no titles or names.",
    "",
    "Example (a few classes of section 67_B):",
    "```json",
    JSON.stringify(example, null, 2),
    "```",
    "",
    "JSON schema the file must match:",
    "```json",
    JSON.stringify(schema, null, 2),
    "```",
  ].join("\n");
}
