import type {
  AdminRoutineVersionDetail,
  ApiError,
  RoutineFile,
  RoutineSection,
  RoutineSectionList,
} from "@ourdiu/shared";
import { PDFDocument } from "pdf-lib";
import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { readRoutineFile } from "../src/services/routine/import";
import { cseRoutinePdf } from "./cse-routine-pdf";
import { eeeRoutinePdf } from "./eee-routine-pdf";
import { api, jsonRequest, pdfFile, signIn, signInAdmin } from "./helpers";

// EEE's routine, read from its PDF (a made-up one in its layout).

let admin: Awaited<ReturnType<typeof signInAdmin>>;
let pdf: Uint8Array;
beforeAll(async () => {
  admin = await signInAdmin();
  pdf = await eeeRoutinePdf();
});

function uploadPdf(bytes: Uint8Array | File, cookie = admin.cookie) {
  const form = new FormData();
  form.set(
    "file",
    bytes instanceof File
      ? bytes
      : new File([bytes], "eee-routine.pdf", { type: "application/pdf" }),
  );
  return api("/api/v1/admin/routine/versions", {
    method: "POST",
    headers: { cookie },
    body: form,
  });
}

const adminCall = (method: string, path: string, body?: unknown) =>
  api(
    `/api/v1/admin/routine${path}`,
    body === undefined
      ? { method, headers: { cookie: admin.cookie } }
      : jsonRequest(method, body, admin.cookie),
  );

describe("reading EEE's routine PDF", () => {
  it("reads the version, the slots, the teachers and every class", async () => {
    const { file, notes } = await readRoutineFile(pdf);
    expect(file).toMatchObject({
      department: "EEE",
      version: "4.0",
      publishedOn: "2026-10-03",
    });
    // One-hour slots, without the break from 12:30 to 1:00.
    expect(file.slots.map((s) => s.start)).toEqual([
      "08:30",
      "09:30",
      "10:30",
      "11:30",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
    ]);
    // The teachers' list, with phone numbers and emails.
    const listed = (name: string, initials: string) => ({
      name,
      phone: "01700000000",
      email: `${initials.toLowerCase()}@example.com`,
    });
    expect(file.teachers).toEqual({
      MSA: listed("Dr. Test Alam", "MSA"),
      MW: listed("Test Wahid", "MW"),
      AAA: listed("Anan Test Azad", "AAA"),
      BS: listed("Bijoy Test", "BS"),
      ShA: listed("Dr. Md. Shahin Test", "ShA"),
    });
    const line = (c: RoutineFile["classes"][number]) =>
      `${c.day} ${c.start}-${c.end} ${c.section}${c.labGroup ? ` (${c.labGroup})` : ""} ${c.course} ${c.room}${c.roomType ? " lab" : ""} ${c.teacher}`;
    expect(file.classes.map(line)).toEqual([
      "SAT 08:30-09:30 1-2 B 0713-121 301 MW",
      "SAT 09:30-10:30 1-2 B 0531-121 301 AAA",
      "SAT 13:00-14:00 1-3 A 0541-131 301 IJM",
      // A double class two sections share: a class for each.
      "SAT 08:30-10:30 1-2 A 0713-121 103 MSA",
      "SAT 08:30-10:30 1-2 E (E1) 0713-121 103 MSA",
      // A lab over two cells is one class.
      "SAT 10:30-12:30 1-2 B (B1) 0713-122 105 lab BS",
      "SAT 10:30-11:30 2-2 C (C2) 0714-222 106 lab DTF",
      "SAT 13:00-15:00 3-3 A (A2) 0714-322 106 lab RS",
      // A room named over several lines; a course's section wrapped onto the next.
      "SAT 08:30-09:30 1-2 D (D2) 0531-122 Civil-A (303) Chemistry Lab lab ShA",
      "SUN 14:00-15:00 4-2 A 0713-421 301 DAM",
    ]);
    expect(notes).toEqual([
      "Saturday 1:00 pm, 301 says 1-3 A but 0541-131 B; read as 1-3 A.",
      "Saturday 2:00 pm, 106 has no lab group; read as 3-3 A (A2)’s lab going on.",
    ]);
  });

  it("refuses files that aren't a PDF it can read", async () => {
    await expect(
      readRoutineFile(new TextEncoder().encode('{"format":1}')),
    ).rejects.toMatchObject({ code: "NOT_A_PDF" });

    const other = await PDFDocument.create();
    other.addPage().drawText("Department of Computer Science and Engineering");
    await expect(readRoutineFile(await other.save())).rejects.toMatchObject({
      code: "UNKNOWN_ROUTINE_PDF",
    });
  });
});

describe("reading CSE's routine PDF", () => {
  it("follows days over pages and reads sections as they're meant", async () => {
    const at = (day: string, start: string, end: string) => ({
      day,
      start,
      end,
    });
    const pdf = await cseRoutinePdf({
      version: "4.1",
      publishedOn: "2026-10-03",
      slots: [
        { start: "08:30", end: "10:00" },
        { start: "10:00", end: "11:30" },
        { start: "11:30", end: "13:00" },
      ],
      classes: [
        // A lab over two slots, for lab group B1 of 67_B.
        {
          ...at("SAT", "08:30", "11:30"),
          course: "CSE322",
          section: "67_B",
          labGroup: "B1",
          room: "G1-017",
          roomType: "lab",
          teacher: "STA",
        },
        // Too long for its cell: it wraps.
        {
          ...at("SAT", "08:30", "10:00"),
          course: "CSE325",
          section: "RE_A(3C)(DMML)",
          room: "ANX1-209",
          teacher: "MHIM",
        },
        // Enough rooms for Saturday to run onto the next page…
        ...Array.from({ length: 60 }, (_, i) => ({
          ...at("SAT", "11:30", "13:00"),
          course: "CSE111",
          section: `${60 + (i % 10)}_${String.fromCharCode(65 + Math.floor(i / 10))}`,
          room: `KT-${300 + i}`,
          teacher: "NT-1",
        })),
        // …and Sunday to start under it, with a slip in a section's name.
        {
          ...at("SUN", "10:00", "11:30"),
          course: "MAT101",
          section: "RE_A (3C.)",
          room: "KT-216",
          teacher: "EEE_1",
        },
      ],
    });
    expect(await PDFDocument.load(pdf).then((d) => d.getPageCount())).toBe(2);

    const { file, notes } = await readRoutineFile(pdf);
    expect(file).toMatchObject({
      department: "CSE",
      version: "4.1",
      publishedOn: "2026-10-03",
    });
    // Retake sections are left out; the wrapped one is read whole, so no note.
    expect(file.classes).toHaveLength(61);
    expect(file.classes.some((c) => c.section.startsWith("RE_"))).toBe(false);
    expect(file.classes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ...at("SAT", "08:30", "11:30"),
          section: "67_B",
          labGroup: "B1",
          room: "G1-017",
          roomType: "lab",
        }),
      ]),
    );
    expect(file.classes.filter((c) => c.day === "SAT")).toHaveLength(61);
    expect(notes).toEqual([]);
  });
});

// The tests share one database and run in order.
describe("uploading a routine PDF", () => {
  it("only lets admins in", async () => {
    const user = await signIn();
    expect((await uploadPdf(pdf, user.cookie)).status).toBe(403);
  });

  it("answers what's wrong with a file it can't read", async () => {
    const res = await uploadPdf(pdfFile());
    expect(res.status).toBe(422);
    expect((await res.json<ApiError>()).error.code).toBe("UNREADABLE_PDF");
  });

  let draft: AdminRoutineVersionDetail;

  it("keeps it as a draft, with what couldn't be read first", async () => {
    const res = await uploadPdf(pdf);
    expect(res.status).toBe(201);
    draft = await res.json<AdminRoutineVersionDetail>();
    expect(draft).toMatchObject({
      department: "EEE",
      version: "4.0",
      status: "draft",
      sectionCount: 8,
      classCount: 10,
    });
    expect(draft.warnings.map((w) => w.kind)).toEqual([
      "unreadable",
      "unreadable",
    ]);
    expect(draft.warnings[0]!.message).toContain("read as 1-3 A");

    // The PDF can be downloaded.
    const original = await adminCall("GET", `/versions/${draft.id}/pdf`);
    expect(original.status).toBe(200);
    expect(original.headers.get("content-disposition")).toContain(
      "eee-routine-4.0.pdf",
    );
    expect(new Uint8Array(await original.arrayBuffer())).toEqual(pdf);

    expect((await uploadPdf(pdf)).status).toBe(409);
  });

  it("shows EEE's sections, with lab groups written as students do", async () => {
    // An admin's details for a teacher stay; the PDF fills in what's empty.
    await adminCall("PUT", "/teachers/EEE/MW", {
      name: "Md. Wahid",
      room: "KT-712",
    });
    await adminCall("POST", `/versions/${draft.id}/live`);
    const list = await api("/api/v1/routine/eee/sections");
    expect(list.status).toBe(200);
    expect(
      (await list.json<RoutineSectionList>()).sections.map((s) => s.section),
    ).toEqual([
      "1-2 A",
      "1-2 B",
      "1-2 D",
      "1-2 E",
      "1-3 A",
      "2-2 C",
      "3-3 A",
      "4-2 A",
    ]);

    // Found as printed, or with an underscore as in page addresses.
    const week = await api("/api/v1/routine/eee/sections/1-2_b");
    expect(week.status).toBe(200);
    const section = await week.json<RoutineSection>();
    expect(section.section).toBe("1-2 B");
    expect(section.labGroups).toEqual(["B1"]);
    expect(section.classes[0]).toMatchObject({
      course: { code: "0713-121", title: null },
      teacher: {
        initials: "MW",
        name: "Md. Wahid",
        phone: "01700000000",
        email: "mw@example.com",
        room: "KT-712",
      },
    });
    expect((await api("/api/v1/routine/eee/sections/1-2%20B")).status).toBe(
      200,
    );

    const sheet = await api("/api/v1/routine/eee/sections/1-2 B/pdf?group=B1");
    expect(sheet.status).toBe(200);
    expect(sheet.headers.get("content-disposition")).toContain(
      "1-2_B1_routine_v4.0.pdf",
    );
  });

  it("keeps each department's teachers apart", async () => {
    // CSE's MW is someone else.
    const cse = await uploadPdf(
      await cseRoutinePdf({
        version: "1.0",
        slots: [{ start: "08:30", end: "10:00" }],
        classes: [
          {
            day: "SAT",
            start: "08:30",
            end: "10:00",
            course: "CSE101",
            section: "65_A",
            room: "KT-201",
            teacher: "MW",
          },
        ],
      }),
    );
    expect(cse.status).toBe(201);
    const { id } = await cse.json<AdminRoutineVersionDetail>();
    await adminCall("PUT", "/teachers/CSE/MW", { name: "A CSE Teacher" });
    await adminCall("POST", `/versions/${id}/live`);

    const eee = await (
      await api("/api/v1/routine/eee/sections/1-2_B")
    ).json<RoutineSection>();
    expect(eee.classes[0]!.teacher?.name).toBe("Md. Wahid");
    const csWeek = await (
      await api("/api/v1/routine/cse/sections/65_A")
    ).json<RoutineSection>();
    expect(csWeek.classes[0]!.teacher?.name).toBe("A CSE Teacher");
  });

  it("deletes a version with its PDF, the live one too", async () => {
    const files = async () =>
      (await env.BUCKET.list({ prefix: "routine/versions/" })).objects.length;
    const before = await files();
    const res = await uploadPdf(await eeeRoutinePdf("4.1"));
    expect(res.status).toBe(201);
    const { id } = await res.json<AdminRoutineVersionDetail>();
    expect(await files()).toBe(before + 1);

    expect((await adminCall("DELETE", `/versions/${id}`)).status).toBe(204);
    expect(await files()).toBe(before);
    // The live one can be too: EEE has no routine then.
    expect((await adminCall("DELETE", `/versions/${draft.id}`)).status).toBe(
      204,
    );
    expect((await api("/api/v1/routine/eee/sections")).status).toBe(404);
  });
});
