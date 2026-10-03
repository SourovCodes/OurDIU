import type {
  AdminRoutineVersionDetail,
  AdminRoutineVersionList,
  ApiError,
  RoutineFile,
  RoutineFileProblem,
  RoutineSection,
  RoutineSectionList,
} from "@ourdiu/shared";
import { beforeAll, describe, expect, it } from "vitest";
import { routineChanges, routineWarnings } from "../src/services/routine/check";
import { api, jsonRequest, signIn, signInAdmin } from "./helpers";

// Section 67_B of the CSE routine v4.1 (a student's PDF of it), and one more section.
const SLOTS = [
  { start: "08:30", end: "10:00" },
  { start: "10:00", end: "11:30" },
  { start: "11:30", end: "13:00" },
  { start: "13:00", end: "14:30" },
  { start: "14:30", end: "16:00" },
  { start: "16:00", end: "17:30" },
];

function routineFile(version: string): RoutineFile {
  return {
    format: 1,
    department: "CSE",
    version,
    publishedOn: "2026-10-02",
    slots: SLOTS,
    courses: {
      CSE315: "Software Engineering",
      CSE317: "Microprocessor and Microcontrollers",
      CSE321: "Computer Networks",
      CSE322: "Computer Networks Lab",
      ACT327: "Financial and Managerial Accounting",
    },
    teachers: { STA: "Test Teacher" },
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
      {
        day: "SUN",
        start: "10:00",
        end: "11:30",
        course: "CSE431",
        section: "65_A",
        room: "KT-208",
        teacher: "SMAH",
      },
    ],
  };
}

let admin: Awaited<ReturnType<typeof signInAdmin>>;
beforeAll(async () => {
  admin = await signInAdmin();
});

const adminCall = (method: string, path: string, body?: unknown) =>
  api(
    `/api/v1/admin/routine${path}`,
    body === undefined
      ? { method, headers: { cookie: admin.cookie } }
      : jsonRequest(method, body, admin.cookie),
  );

async function upload(file: RoutineFile) {
  const res = await adminCall("POST", "/versions", file);
  expect(res.status).toBe(201);
  return res.json<AdminRoutineVersionDetail>();
}

// The tests share one database and run in order: nothing is live at first.
describe("routine versions", () => {
  it("only lets admins in", async () => {
    const user = await signIn();
    const res = await api("/api/v1/admin/routine/versions", {
      headers: { cookie: user.cookie },
    });
    expect(res.status).toBe(403);
    const upload = await api(
      "/api/v1/admin/routine/versions",
      jsonRequest("POST", routineFile("1.0"), user.cookie),
    );
    expect(upload.status).toBe(403);
  });

  it("has no routine for students before a version is live", async () => {
    const res = await api("/api/v1/routine/cse/sections");
    expect(res.status).toBe(404);
    expect((await res.json<ApiError>()).error.code).toBe("NO_ROUTINE");
  });

  it("points at each problem of a file that can't be used", async () => {
    const file = routineFile("9.9");
    file.classes[0]!.start = "1:00";
    file.classes[1]!.start = "09:00";
    file.classes[2]!.day = "Sunday" as never;
    const res = await adminCall("POST", "/versions", file);
    expect(res.status).toBe(422);
    const body = await res.json<ApiError>();
    expect(body.error.code).toBe("INVALID_ROUTINE_FILE");
    const problems = body.error.details as RoutineFileProblem[];
    expect(problems.map((p) => p.path)).toEqual(
      expect.arrayContaining(["classes[0].start", "classes[2].day"]),
    );
    expect(
      problems.find((p) => p.path === "classes[0].start")!.message,
    ).toMatch(/24-hour/);

    // Times are checked against the slots once the file is otherwise right.
    const offSlot = routineFile("9.9");
    offSlot.classes[1]!.start = "09:00";
    const off = await adminCall("POST", "/versions", offSlot);
    const offProblems = (await off.json<ApiError>()).error
      .details as RoutineFileProblem[];
    expect(offProblems).toEqual([
      {
        path: "classes[1].start",
        message: expect.stringContaining("isn't the start of a slot"),
      },
    ]);
  });

  it("rejects unknown fields and departments", async () => {
    const res = await adminCall("POST", "/versions", {
      ...routineFile("9.8"),
      department: "BBA",
      extra: true,
    });
    expect(res.status).toBe(422);
    const paths = (
      (await res.json<ApiError>()).error.details as RoutineFileProblem[]
    ).map((p) => p.path);
    expect(paths).toEqual(expect.arrayContaining(["department", ""]));
  });

  let first: AdminRoutineVersionDetail;

  it("saves a file as a draft with its warnings", async () => {
    first = await upload(routineFile("4.1"));
    expect(first).toMatchObject({
      department: "CSE",
      version: "4.1",
      status: "draft",
      sectionCount: 2,
      classCount: 11,
      liveAt: null,
      comparedWith: null,
      uploadedBy: { name: "Test User" },
    });
    // CSE431 has no title; KT-208 isn't booked twice (Sunday 10:00 vs Monday).
    expect(first.warnings).toEqual([
      { kind: "untitled_course", message: expect.stringContaining("CSE431") },
    ]);

    const again = await adminCall("POST", "/versions", routineFile("4.1"));
    expect(again.status).toBe(409);
  });

  it("keeps the file as it was uploaded", async () => {
    const res = await adminCall("GET", `/versions/${first.id}/file`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain(
      "cse-routine-4.1.json",
    );
    expect((await res.json<RoutineFile>()).version).toBe("4.1");
  });

  it("makes a version live for students", async () => {
    const res = await adminCall("POST", `/versions/${first.id}/live`);
    expect(res.status).toBe(200);
    const live = await res.json<AdminRoutineVersionDetail>();
    expect(live.status).toBe("live");
    expect(live.liveAt).not.toBeNull();

    const list = await api("/api/v1/routine/cse/sections");
    expect(list.status).toBe(200);
    const sections = await list.json<RoutineSectionList>();
    expect(sections.version).toMatchObject({
      department: "CSE",
      version: "4.1",
      publishedOn: "2026-10-02",
    });
    expect(sections.sections).toEqual([
      { section: "65_A", labGroups: [], classCount: 1 },
      { section: "67_B", labGroups: ["B1", "B2"], classCount: 10 },
    ]);
  });

  it("shows a section's week in order, found regardless of case", async () => {
    const res = await api("/api/v1/routine/cse/sections/67_b");
    expect(res.status).toBe(200);
    const week = await res.json<RoutineSection>();
    expect(week.section).toBe("67_B");
    expect(week.labGroups).toEqual(["B1", "B2"]);
    expect(week.slots).toEqual(SLOTS);
    expect(week.classes.map((c) => `${c.day} ${c.start}`)).toEqual([
      "SAT 13:00",
      "SAT 14:30",
      "SUN 10:00",
      "SUN 11:30",
      "MON 08:30",
      "MON 11:30",
      "MON 14:30",
      "WED 11:30",
      "WED 14:30",
      "WED 16:00",
    ]);
    expect(week.classes[0]).toEqual({
      day: "SAT",
      start: "13:00",
      end: "14:30",
      course: { code: "CSE321", title: "Computer Networks" },
      labGroup: null,
      room: "KT-222",
      roomType: null,
      teacher: { initials: "STA", name: "Test Teacher" },
    });
    expect(week.classes[4]).toMatchObject({
      labGroup: "B2",
      roomType: "lab",
      teacher: { initials: "STA" },
    });

    const missing = await api("/api/v1/routine/cse/sections/99_Z");
    expect(missing.status).toBe(404);
    expect((await missing.json<ApiError>()).error.code).toBe(
      "SECTION_NOT_FOUND",
    );
  });

  it("downloads a section's week as a PDF", async () => {
    const res = await api("/api/v1/routine/cse/sections/67_B/pdf?group=B1");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="67_B1_routine_v4.1.pdf"',
    );
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const whole = await api("/api/v1/routine/cse/sections/67_B/pdf");
    expect(whole.headers.get("content-disposition")).toContain(
      "67_B_routine_v4.1.pdf",
    );

    const noGroup = await api("/api/v1/routine/cse/sections/67_B/pdf?group=B3");
    expect(noGroup.status).toBe(404);
  });

  it("reviews a new version against the live one, then replaces it", async () => {
    const file = routineFile("4.2");
    file.classes[0]!.start = "10:00"; // CSE321 moves on Saturday
    file.classes[0]!.end = "11:30";
    file.classes[9]!.room = "KT-322"; // CSE321 on Wednesday, another room
    file.classes.pop(); // 65_A is gone
    file.classes.push({
      day: "THU",
      start: "08:30",
      end: "10:00",
      course: "CSE111",
      section: "73_K",
      room: "KT-222",
      teacher: "STA",
    });
    file.courses = { CSE111: "Computer Fundamentals" };
    const draft = await upload(file);
    expect(draft.comparedWith).toBe("4.1");
    expect(draft.changes).toMatchObject({
      moved: 1,
      room: 1,
      teacher: 0,
      added: 0,
      removed: 0,
      sectionsAdded: ["73_K"],
      sectionsRemoved: ["65_A"],
    });
    expect(draft.changes.items[0]).toMatchObject({
      section: "67_B",
      kind: "moved",
      before: { day: "SAT", start: "13:00", course: "CSE321" },
      after: { day: "SAT", start: "10:00", course: "CSE321" },
    });

    // Students still see 4.1.
    const before = await api("/api/v1/routine/cse/sections/67_B");
    expect((await before.json<RoutineSection>()).version.version).toBe("4.1");

    await adminCall("POST", `/versions/${draft.id}/live`);
    const after = await (
      await api("/api/v1/routine/cse/sections/67_B")
    ).json<RoutineSection>();
    expect(after.version.version).toBe("4.2");
    // Titles from 4.1 stay known though 4.2 doesn't repeat them.
    expect(after.classes[0]!.course).toEqual({
      code: "CSE321",
      title: "Computer Networks",
    });

    const list = await (
      await adminCall("GET", "/versions")
    ).json<AdminRoutineVersionList>();
    const byVersion = new Map(list.items.map((v) => [v.version, v]));
    expect(byVersion.get("4.2")!.status).toBe("live");
    expect(byVersion.get("4.1")).toMatchObject({ status: "previous" });
    expect(byVersion.get("4.1")!.replacedAt).not.toBeNull();
    expect(list.items.filter((v) => v.status === "live")).toHaveLength(1);

    // Rolling back makes 4.1 live again.
    const back = await adminCall("POST", `/versions/${first.id}/live`);
    expect((await back.json<AdminRoutineVersionDetail>()).status).toBe("live");
    const rolledBack = await (
      await api("/api/v1/routine/cse/sections/65_A")
    ).json<RoutineSection>();
    expect(rolledBack.version.version).toBe("4.1");
  });

  it("deletes drafts only", async () => {
    const draft = await upload(routineFile("5.0"));
    expect((await adminCall("DELETE", `/versions/${draft.id}`)).status).toBe(
      204,
    );
    expect((await adminCall("GET", `/versions/${draft.id}`)).status).toBe(404);

    const wasLive = await adminCall("DELETE", `/versions/${first.id}`);
    expect(wasLive.status).toBe(409);
  });
});

describe("routine checks", () => {
  const cls = (over: Partial<Parameters<typeof routineWarnings>[0][0]>) => ({
    day: "SUN" as const,
    start: 600,
    end: 690,
    course: "CSE315",
    section: "67_B",
    labGroup: null,
    room: "KT-213",
    teacher: "AS",
    ...over,
  });

  it("warns about clashes, but not lab groups or combined classes", () => {
    const warnings = routineWarnings(
      [
        cls({}),
        cls({}), // listed twice
        cls({ course: "CSE317", room: "KT-214", teacher: "MRR" }), // 67_B twice at once
        cls({ section: "67_C", course: "CSE999", teacher: "X" }), // KT-213 twice
        cls({ section: "68_A", room: "KT-300" }), // AS in two rooms
        // Lab groups at the same time are fine.
        cls({ section: "70_A", labGroup: "A1", room: "L1", teacher: "P" }),
        cls({ section: "70_A", labGroup: "A2", room: "L2", teacher: "Q" }),
        // The same course for two sections in one room is a combined class.
        cls({ section: "71_A", room: "R9", teacher: "Z" }),
        cls({ section: "71_B", room: "R9", teacher: "Z" }),
      ],
      new Set(["CSE315", "CSE317"]),
    );
    expect(warnings.map((w) => w.kind).sort()).toEqual([
      "duplicate",
      "room_clash",
      "section_clash",
      "teacher_clash",
      "untitled_course",
    ]);
  });

  it("tells a teacher change from a move", () => {
    const changes = routineChanges(
      [cls({}), cls({ day: "MON" })],
      [cls({ teacher: "NEW" }), cls({ day: "TUE" })],
    );
    expect(changes).toMatchObject({ teacher: 1, moved: 1, room: 0 });
  });
});
