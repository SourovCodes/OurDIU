import type {
  AdminRoutineVersionDetail,
  ApiError,
  RoutineSection,
  RoutineSectionList,
} from "@ourdiu/shared";
import { beforeAll, describe, expect, it } from "vitest";
import { readRoutineFile } from "../src/services/routine/import";
import { api, jsonRequest, signInAdmin } from "./helpers";
import { sweRoutineXlsx } from "./swe-routine-xlsx";

// SWE's routine, read from its Excel sheet (a made-up one in its layout).

const NAME = "swe-routine-fall-2026-studentversion04-4b80406fe1 (1).xlsx";

let admin: Awaited<ReturnType<typeof signInAdmin>>;
let xlsx: Uint8Array;
beforeAll(async () => {
  admin = await signInAdmin();
  xlsx = await sweRoutineXlsx();
});

function upload(name: string, version?: string) {
  const form = new FormData();
  form.set("file", new File([xlsx], name));
  if (version) form.set("version", version);
  return api("/api/v1/admin/routine/versions", {
    method: "POST",
    headers: { cookie: admin.cookie },
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

describe("reading SWE's routine sheet", () => {
  it("reads the date, the slots and every class", async () => {
    const { file, notes, kind } = await readRoutineFile(xlsx, { name: NAME });
    expect(kind).toBe("xlsx");
    expect(file).toMatchObject({
      department: "SWE",
      // Not in the sheet: from the file's name.
      version: "4",
      publishedOn: "2026-10-03",
    });
    expect(file.slots).toEqual([
      { start: "08:30", end: "10:00" },
      { start: "10:00", end: "11:30" },
      { start: "11:30", end: "13:00" },
      { start: "13:00", end: "14:30" },
      { start: "14:30", end: "16:00" },
      { start: "16:00", end: "17:30" },
    ]);
    const at = (section: string, day: string) =>
      file.classes
        .filter((c) => c.section === section && c.day === day)
        .map(
          (c) =>
            `${c.start}-${c.end} ${c.course}${c.labGroup ? ` ${c.labGroup}` : ""} ${c.room}${c.roomType ? " (lab)" : ""} ${c.teacher}`,
        );
    expect(at("44_G", "SAT")).toEqual([
      "14:30-16:00 SE232 611 KM",
      // A lab over two slots is one class, for lab group G1.
      "08:30-11:30 SE231 G1 Annex-409 (lab) FAJ",
    ]);
    expect(at("44_G", "MON")).toEqual([
      "10:00-13:00 SE231 G2 G1-007 (lab) FAJ",
      "13:00-14:30 SE235 612 PS",
    ]);
    // A double class; a major's section and its lab group; online classes.
    expect(at("43_C", "SAT")).toEqual(["11:30-14:30 GE324 611 SK"]);
    expect(at("41_DSA", "SAT")).toEqual(["08:30-10:00 SE331 DSA1 Online RA"]);
    expect(file.classes).toHaveLength(7);
    expect(notes).toEqual([
      "Saturday 10:00 am, 701A: couldn’t read “SE2X-44”.",
      "Left out, as they aren’t a batch’s sections: SE221 (UC_A).",
    ]);
  });

  it("takes the version given over the one in the file's name", async () => {
    const { file } = await readRoutineFile(xlsx, {
      name: NAME,
      version: "4.2",
    });
    expect(file.version).toBe("4.2");
  });

  it("asks for a version when there's none", async () => {
    const res = await upload("swe-routine.xlsx");
    expect(res.status).toBe(422);
    expect((await res.json<ApiError>()).error.code).toBe("NO_VERSION");
  });
});

describe("SWE's routine", () => {
  let draft: AdminRoutineVersionDetail;

  it("is kept as a draft, with its sheet to download", async () => {
    const res = await upload(NAME, "4");
    expect(res.status).toBe(201);
    draft = await res.json<AdminRoutineVersionDetail>();
    expect(draft).toMatchObject({
      department: "SWE",
      version: "4",
      status: "draft",
    });
    // Only what couldn't be read: two online classes at once aren't a room
    // clash.
    expect(draft.warnings.map((w) => w.kind)).toEqual([
      "unreadable",
      "unreadable",
    ]);

    const original = await adminCall("GET", `/versions/${draft.id}/pdf`);
    expect(original.status).toBe(200);
    expect(original.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(original.headers.get("content-disposition")).toContain(
      "swe-routine-4.xlsx",
    );
    expect(new Uint8Array(await original.arrayBuffer())).toEqual(xlsx);
  });

  it("shows SWE's sections, lab groups as students write them", async () => {
    await adminCall("POST", `/versions/${draft.id}/live`);
    const list = await api("/api/v1/routine/swe/sections");
    expect(list.status).toBe(200);
    expect(
      (await list.json<RoutineSectionList>()).sections.map((s) => s.section),
    ).toEqual(["41_DSA", "43_C", "44_G", "46_C"]);

    const week = await api("/api/v1/routine/swe/sections/44_G");
    const section = await week.json<RoutineSection>();
    expect(section.labGroups).toEqual(["G1", "G2"]);

    const sheet = await api(
      "/api/v1/routine/swe/sections/41_DSA/pdf?group=DSA1",
    );
    expect(sheet.status).toBe(200);
    expect(sheet.headers.get("content-disposition")).toContain(
      "41_DSA1_routine_v4.pdf",
    );
  });
});
