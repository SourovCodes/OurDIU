import type {
  AdminRoutineCourseList,
  AdminRoutineTeacher,
  AdminRoutineTeacherList,
  AdminRoutineVersionDetail,
  AdminRoutineVersionList,
  ApiError,
  RoutineFile,
  RoutineFileProblem,
  RoutineSection,
  RoutineSectionList,
  RoutineTeacherList,
  RoutineTeacherWeek,
} from "@ourdiu/shared";
import { PDFDocument } from "pdf-lib";
import { beforeAll, describe, expect, it } from "vitest";
import { routineChanges, routineWarnings } from "../src/services/routine/check";
import { teacherClasses } from "../src/services/routine/teachers";
import { cseRoutinePdf } from "./cse-routine-pdf";
import { api, jsonRequest, signIn, signInAdmin } from "./helpers";

// Section 67_B of the CSE routine v4.1 (a student's PDF of it), and one more section,
// uploaded as PDFs in CSE's layout (test/cse-routine-pdf.ts).
const SLOTS = [
  { start: "08:30", end: "10:00" },
  { start: "10:00", end: "11:30" },
  { start: "11:30", end: "13:00" },
  { start: "13:00", end: "14:30" },
  { start: "14:30", end: "16:00" },
  { start: "16:00", end: "17:30" },
];

const TITLES = {
  CSE315: "Software Engineering",
  CSE317: "Microprocessor and Microcontrollers",
  CSE321: "Computer Networks",
  CSE322: "Computer Networks Lab",
  ACT327: "Financial and Managerial Accounting",
};

function routineFile(version: string): RoutineFile {
  return {
    format: 1,
    department: "CSE",
    version,
    publishedOn: "2026-10-02",
    slots: SLOTS,
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

function postPdf(
  pdf: Uint8Array,
  cookie = admin.cookie,
  fields: Record<string, string> = {},
) {
  const form = new FormData();
  form.set(
    "file",
    new File([pdf], "cse-routine.pdf", { type: "application/pdf" }),
  );
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return api("/api/v1/admin/routine/versions", {
    method: "POST",
    headers: { cookie },
    body: form,
  });
}

async function upload(file: RoutineFile) {
  const res = await postPdf(await cseRoutinePdf(file));
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
    const upload = await postPdf(
      await cseRoutinePdf(routineFile("1.0")),
      user.cookie,
    );
    expect(upload.status).toBe(403);
  });

  it("has no routine for students before a version is live", async () => {
    const res = await api("/api/v1/routine/cse/sections");
    expect(res.status).toBe(404);
    expect((await res.json<ApiError>()).error.code).toBe("NO_ROUTINE");
  });

  it("turns away PDFs it can't read, saying why", async () => {
    const notPdf = await postPdf(new TextEncoder().encode('{"format":1}'));
    expect(notPdf.status).toBe(422);
    expect((await notPdf.json<ApiError>()).error.code).toBe("NOT_A_PDF");

    const other = await PDFDocument.create();
    other.addPage().drawText("Class Routine for BBA Program");
    const unknown = await postPdf(await other.save());
    expect((await unknown.json<ApiError>()).error.code).toBe(
      "UNKNOWN_ROUTINE_PDF",
    );

    // CSE's layout, but without a version: what's read can't be used.
    const noVersion = await postPdf(await cseRoutinePdf(routineFile("")));
    expect(noVersion.status).toBe(422);
    const body = await noVersion.json<ApiError>();
    expect(body.error.code).toBe("INVALID_ROUTINE_FILE");
    expect(
      (body.error.details as RoutineFileProblem[]).map((p) => p.path),
    ).toEqual(["version"]);
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
    // KT-208 isn't booked twice (Sunday 10:00 vs Monday): no warnings. No course
    // has a title yet, nor any teacher a name.
    expect(first.warnings).toEqual([]);
    expect(first.catalog).toEqual({
      courses: 6,
      titled: 0,
      teachers: 5,
      named: 0,
    });

    const again = await postPdf(await cseRoutinePdf(routineFile("4.1")));
    expect(again.status).toBe(409);
  });

  it("keeps the PDF it was read from", async () => {
    const res = await adminCall("GET", `/versions/${first.id}/pdf`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain(
      "cse-routine-4.1.pdf",
    );
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(
      await cseRoutinePdf(routineFile("4.1")),
    );
  });

  it("lists the department's courses and teachers for titles and details", async () => {
    const courses = await (
      await adminCall("GET", "/courses?department=CSE")
    ).json<AdminRoutineCourseList>();
    expect(courses.items.map((c) => c.code)).toEqual([
      "ACT327",
      "CSE315",
      "CSE317",
      "CSE321",
      "CSE322",
      "CSE431",
    ]);
    // Counted in the newest version, a draft until one is live.
    expect(courses.items[0]).toEqual({
      department: "CSE",
      code: "ACT327",
      title: null,
      sections: 1,
    });

    for (const [code, title] of Object.entries(TITLES)) {
      const res = await adminCall("PUT", `/courses/CSE/${code}`, { title });
      expect(res.status).toBe(200);
    }
    expect(
      (await adminCall("PUT", "/courses/CSE/CSE321", { title: " " })).status,
    ).toBe(422);

    const teachers = await (
      await adminCall("GET", "/teachers?department=CSE")
    ).json<AdminRoutineTeacherList>();
    expect(teachers.items.map((t) => t.initials)).toEqual([
      "AS",
      "IK",
      "MRR",
      "SMAH",
      "STA",
    ]);
    const sta = await adminCall("PUT", "/teachers/CSE/STA", {
      name: "Test Teacher",
      designation: "Assistant Professor",
      phone: "01712-345678",
      email: "sta@diu.edu.bd",
      room: "KT-712",
    });
    expect(await sta.json<AdminRoutineTeacher>()).toEqual({
      department: "CSE",
      initials: "STA",
      name: "Test Teacher",
      designation: "Assistant Professor",
      phone: "01712-345678",
      email: "sta@diu.edu.bd",
      room: "KT-712",
      classes: 4,
      courses: ["CSE321", "CSE322"],
    });
    const bad = await adminCall("PUT", "/teachers/CSE/STA", {
      name: "Test Teacher",
      email: "not an email",
    });
    expect(bad.status).toBe(422);
    // A teacher added by hand, before any version has them.
    expect(
      (await adminCall("PUT", "/teachers/CSE/NT-1", { name: "New Teacher" }))
        .status,
    ).toBe(200);

    // The version's review counts them as they're added.
    const reviewed = await (
      await adminCall("GET", `/versions/${first.id}`)
    ).json<AdminRoutineVersionDetail>();
    expect(reviewed.catalog).toEqual({
      courses: 6,
      titled: 5,
      teachers: 5,
      named: 1,
    });

    const user = await signIn();
    const denied = await api("/api/v1/admin/routine/courses?department=CSE", {
      headers: { cookie: user.cookie },
    });
    expect(denied.status).toBe(403);
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
      source: null,
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
      teacher: {
        initials: "STA",
        name: "Test Teacher",
        designation: "Assistant Professor",
        phone: "01712-345678",
        email: "sta@diu.edu.bd",
        room: "KT-712",
      },
    });
    // Details nobody added stay empty.
    expect(week.classes[2]!.teacher).toEqual({
      initials: "AS",
      name: null,
      designation: null,
      phone: null,
      email: null,
      room: null,
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

  it("lists the live routine's teachers, and shows a teacher's week", async () => {
    const list = await api("/api/v1/routine/cse/teachers");
    expect(list.status).toBe(200);
    const { teachers } = await list.json<RoutineTeacherList>();
    expect(teachers.map((t) => t.initials)).toEqual([
      "AS",
      "IK",
      "MRR",
      "SMAH",
      "STA",
    ]);
    expect(teachers.find((t) => t.initials === "STA")).toEqual({
      initials: "STA",
      name: "Test Teacher",
      courses: ["CSE321", "CSE322"],
      classCount: 4,
    });

    // Found regardless of case, with its details and the sections attending.
    const res = await api("/api/v1/routine/cse/teachers/sta");
    expect(res.status).toBe(200);
    const week = await res.json<RoutineTeacherWeek>();
    expect(week.teacher).toEqual({
      initials: "STA",
      name: "Test Teacher",
      designation: "Assistant Professor",
      phone: "01712-345678",
      email: "sta@diu.edu.bd",
      room: "KT-712",
    });
    expect(week.slots).toEqual(SLOTS);
    expect(
      week.classes.map(
        (c) =>
          `${c.day} ${c.start} ${c.course.code} ${c.sections.map((s) => s.section + (s.labGroup ?? "")).join("+")}`,
      ),
    ).toEqual([
      "SAT 13:00 CSE321 67_B",
      "MON 08:30 CSE322 67_BB2",
      "MON 14:30 CSE322 67_BB1",
      "WED 16:00 CSE321 67_B",
    ]);
    expect(week.classes[0]).toEqual({
      day: "SAT",
      start: "13:00",
      end: "14:30",
      course: { code: "CSE321", title: "Computer Networks" },
      room: "KT-222",
      roomType: null,
      sections: [{ section: "67_B", labGroup: null }],
    });

    const missing = await api("/api/v1/routine/cse/teachers/XYZ");
    expect(missing.status).toBe(404);
    expect((await missing.json<ApiError>()).error.code).toBe(
      "TEACHER_NOT_FOUND",
    );
    // Not initials at all.
    expect((await api("/api/v1/routine/cse/teachers/1-2")).status).toBe(422);
    // EEE has no live routine.
    const eee = await api("/api/v1/routine/eee/teachers");
    expect((await eee.json<ApiError>()).error.code).toBe("NO_ROUTINE");
  });

  it("downloads a teacher's week as a PDF", async () => {
    const res = await api("/api/v1/routine/cse/teachers/sta/pdf");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="STA_routine_v4.1.pdf"',
    );
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect((await api("/api/v1/routine/cse/teachers/XYZ/pdf")).status).toBe(
      404,
    );
  });

  it("pages and searches courses and teachers, and removes them in bulk", async () => {
    const page = await (
      await adminCall("GET", "/courses?department=CSE&pageSize=2&page=2")
    ).json<AdminRoutineCourseList>();
    expect(page).toMatchObject({
      page: 2,
      pageSize: 2,
      total: 6,
      all: 6,
      titled: 5,
      version: "4.1",
    });
    expect(page.items.map((c) => c.code)).toEqual(["CSE317", "CSE321"]);
    const codes = async (query: string) =>
      (
        await (
          await adminCall("GET", `/courses?department=CSE&${query}`)
        ).json<AdminRoutineCourseList>()
      ).items.map((c) => c.code);
    expect(await codes("missing=true")).toEqual(["CSE431"]);
    expect(await codes("q=networks")).toEqual(["CSE321", "CSE322"]);

    const removed = await adminCall("POST", "/courses/remove", {
      department: "CSE",
      codes: ["ACT327", "CSE315", "CSE431"],
    });
    expect(await removed.json()).toEqual({ removed: 2 });
    expect(await codes("missing=true")).toEqual(["ACT327", "CSE315", "CSE431"]);
    expect(
      (
        await adminCall("POST", "/courses/remove", {
          department: "CSE",
          codes: [],
        })
      ).status,
    ).toBe(422);

    // NT-1 was only added by hand: forgetting them takes them off the list.
    const forgot = await adminCall("POST", "/teachers/remove", {
      department: "CSE",
      initials: ["NT-1"],
    });
    expect(await forgot.json()).toEqual({ removed: 1 });
    const teachers = await (
      await adminCall("GET", "/teachers?department=CSE&q=sta")
    ).json<AdminRoutineTeacherList>();
    expect(teachers).toMatchObject({ total: 1, all: 5, named: 1 });
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
    // Titles are the department's, not a version's.
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

  it("previews a draft's section as students would see it", async () => {
    const file = routineFile("5.0");
    file.classes[0]!.room = "KT-999";
    const draft = await upload(file);
    expect(draft.sections).toEqual(["65_A", "67_B"]);

    const res = await adminCall("GET", `/versions/${draft.id}/sections/67_b`);
    expect(res.status).toBe(200);
    const week = await res.json<RoutineSection>();
    expect(week.version.version).toBe("5.0");
    expect(week.classes[0]!.room).toBe("KT-999");
    // Students still see the live version.
    const live = await (
      await api("/api/v1/routine/cse/sections/67_B")
    ).json<RoutineSection>();
    expect(live.classes[0]!.room).toBe("KT-222");

    expect(
      (await adminCall("GET", `/versions/${draft.id}/sections/99_Z`)).status,
    ).toBe(404);
    const user = await signIn();
    const denied = await api(
      `/api/v1/admin/routine/versions/${draft.id}/sections/67_B`,
      { headers: { cookie: user.cookie } },
    );
    expect(denied.status).toBe(403);
  });

  it("numbers a version at upload, and renumbers it later", async () => {
    // A PDF without a version is read with the one given.
    const res = await postPdf(
      await cseRoutinePdf(routineFile("")),
      admin.cookie,
      { version: "3.9" },
    );
    expect(res.status).toBe(201);
    const draft = await res.json<AdminRoutineVersionDetail>();
    expect(draft.version).toBe("3.9");
    // The one given wins over the one printed.
    const printed = await postPdf(
      await cseRoutinePdf(routineFile("9.1")),
      admin.cookie,
      { version: "9.2" },
    );
    const second = await printed.json<AdminRoutineVersionDetail>();
    expect(second.version).toBe("9.2");
    const badField = await postPdf(
      await cseRoutinePdf(routineFile("9.3")),
      admin.cookie,
      { version: "v9" },
    );
    expect(badField.status).toBe(422);

    const renumbered = await adminCall("PATCH", `/versions/${draft.id}`, {
      version: "3.9.1",
    });
    expect(renumbered.status).toBe(200);
    expect((await renumbered.json<AdminRoutineVersionDetail>()).version).toBe(
      "3.9.1",
    );
    const taken = await adminCall("PATCH", `/versions/${draft.id}`, {
      version: "4.1",
    });
    expect(taken.status).toBe(409);
    expect((await taken.json<ApiError>()).error.code).toBe("VERSION_EXISTS");
    expect(
      (await adminCall("PATCH", `/versions/${draft.id}`, { version: "four" }))
        .status,
    ).toBe(422);

    // The live version's new number is what students see.
    await adminCall("PATCH", `/versions/${first.id}`, { version: "4.1.1" });
    const list = await (
      await api("/api/v1/routine/cse/sections")
    ).json<RoutineSectionList>();
    expect(list.version.version).toBe("4.1.1");
    await adminCall("PATCH", `/versions/${first.id}`, { version: "4.1" });

    for (const { id } of [draft, second]) {
      await adminCall("DELETE", `/versions/${id}`);
    }
  });

  it("deletes any version, the live one too", async () => {
    const list = await (
      await adminCall("GET", "/versions")
    ).json<AdminRoutineVersionList>();
    const byVersion = new Map(list.items.map((v) => [v.version, v]));
    // A draft, and 4.2, which was live before the rollback.
    for (const version of ["5.0", "4.2"]) {
      const { id } = byVersion.get(version)!;
      expect((await adminCall("DELETE", `/versions/${id}`)).status).toBe(204);
      expect((await adminCall("GET", `/versions/${id}`)).status).toBe(404);
    }

    // Without its live version, CSE has no routine until another goes live.
    const live = await adminCall("DELETE", `/versions/${first.id}`);
    expect(live.status).toBe(204);
    const none = await api("/api/v1/routine/cse/sections");
    expect(none.status).toBe(404);
    expect((await none.json<ApiError>()).error.code).toBe("NO_ROUTINE");
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
    const warnings = routineWarnings([
      cls({}),
      cls({}), // listed twice
      cls({ course: "CSE317", room: "KT-214", teacher: "MRR" }), // 67_B twice at once
      cls({ section: "67_C", course: "CSE999", teacher: "X" }), // KT-213 twice
      cls({ section: "68_A", room: "KT-300" }), // AS in two rooms
      // Lab groups at the same time are fine.
      cls({ section: "70_A", labGroup: "A1", room: "L1", teacher: "P" }),
      cls({ section: "70_A", labGroup: "A2", room: "L2", teacher: "Q" }),
      // A retake section's courses at the same time are its design.
      cls({
        section: "RE_A(3C)",
        course: "CSE317",
        room: "R1",
        teacher: "T1",
      }),
      cls({
        section: "RE_A(3C)",
        course: "ENG101",
        room: "R2",
        teacher: "T2",
      }),
      // The same course for two sections in one room is a combined class.
      cls({ section: "71_A", room: "R9", teacher: "Z" }),
      cls({ section: "71_B", room: "R9", teacher: "Z" }),
    ]);
    expect(warnings.map((w) => w.kind).sort()).toEqual([
      "duplicate",
      "room_clash",
      "section_clash",
      "teacher_clash",
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

describe("a teacher's week", () => {
  const row = {
    day: "SUN" as const,
    start: 600,
    end: 690,
    course: "CSE431",
    title: null,
    labGroup: null,
    room: "KT-208",
    roomType: null,
  };

  it("makes sections sharing a class one class, in day and time order", () => {
    const week = teacherClasses([
      { ...row, day: "MON", section: "65_A" },
      { ...row, section: "65_B" },
      { ...row, section: "65_A" },
      // Same time, another room: another class.
      { ...row, section: "65_C", room: "KT-209" },
    ]);
    expect(
      week.map((c) => [c.day, c.room, c.sections.map((s) => s.section)]),
    ).toEqual([
      ["SUN", "KT-208", ["65_A", "65_B"]],
      ["SUN", "KT-209", ["65_C"]],
      ["MON", "KT-208", ["65_A"]],
    ]);
    expect(week[0]).toMatchObject({ start: "10:00", end: "11:30" });
  });
});
