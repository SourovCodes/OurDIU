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
import { readRoutinePdf } from "../src/services/routine/import";
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
  return api("/api/v1/admin/routine/versions/pdf", {
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
    const { file, notes } = await readRoutinePdf(pdf);
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
    // Names only: the list's phone numbers and emails aren't read.
    expect(file.teachers).toEqual({
      MSA: "Dr. Test Alam",
      MW: "Test Wahid",
      AAA: "Anan Test Azad",
      BS: "Bijoy Test",
      ShA: "Dr. Md. Shahin Test",
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
      readRoutinePdf(new TextEncoder().encode('{"format":1}')),
    ).rejects.toMatchObject({ code: "NOT_A_PDF" });

    const other = await PDFDocument.create();
    other.addPage().drawText("Department of Computer Science and Engineering");
    await expect(readRoutinePdf(await other.save())).rejects.toMatchObject({
      code: "UNKNOWN_ROUTINE_PDF",
    });
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
      hasPdf: true,
      sectionCount: 8,
      classCount: 10,
    });
    expect(draft.warnings.map((w) => w.kind)).toEqual([
      "unreadable",
      "unreadable",
      "untitled_course",
    ]);
    expect(draft.warnings[0]!.message).toContain("read as 1-3 A");

    // The PDF and the file read from it can be downloaded.
    const original = await adminCall("GET", `/versions/${draft.id}/pdf`);
    expect(original.status).toBe(200);
    expect(original.headers.get("content-disposition")).toContain(
      "eee-routine-4.0.pdf",
    );
    expect(new Uint8Array(await original.arrayBuffer())).toEqual(pdf);
    const file = await adminCall("GET", `/versions/${draft.id}/file`);
    expect((await file.json<RoutineFile>()).classes).toHaveLength(10);

    expect((await uploadPdf(pdf)).status).toBe(409);
  });

  it("shows EEE's sections, with lab groups written as students do", async () => {
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
      teacher: { initials: "MW", name: "Test Wahid" },
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
    const cse = await adminCall("POST", "/versions", {
      format: 1,
      department: "CSE",
      version: "1.0",
      slots: [{ start: "08:30", end: "10:00" }],
      teachers: { MW: "A CSE Teacher" },
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
    });
    expect(cse.status).toBe(201);
    const { id, hasPdf } = await cse.json<AdminRoutineVersionDetail>();
    expect(hasPdf).toBe(false);
    await adminCall("POST", `/versions/${id}/live`);

    const eee = await (
      await api("/api/v1/routine/eee/sections/1-2_B")
    ).json<RoutineSection>();
    expect(eee.classes[0]!.teacher?.name).toBe("Test Wahid");
    const csWeek = await (
      await api("/api/v1/routine/cse/sections/65_A")
    ).json<RoutineSection>();
    expect(csWeek.classes[0]!.teacher?.name).toBe("A CSE Teacher");
  });

  it("deletes a version with its PDF", async () => {
    const files = async () =>
      (await env.BUCKET.list({ prefix: "routine/versions/" })).objects.length;
    const before = await files();
    const res = await uploadPdf(await eeeRoutinePdf("4.1"));
    expect(res.status).toBe(201);
    const { id } = await res.json<AdminRoutineVersionDetail>();
    expect(await files()).toBe(before + 2);

    expect((await adminCall("DELETE", `/versions/${id}`)).status).toBe(204);
    expect(await files()).toBe(before);
    // The live one can't be.
    expect((await adminCall("DELETE", `/versions/${draft.id}`)).status).toBe(
      409,
    );
  });
});
