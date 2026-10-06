import { COVER_PAGE_TEMPLATES } from "@ourdiu/shared/cover-pages";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { api, jsonRequest } from "./helpers";

const make = (template: string, body: unknown) =>
  api(`/api/v1/cover-page/${template}/pdf`, jsonRequest("POST", body));

const details = {
  courseCode: "CSE311",
  courseTitle: "Operating Systems",
  topic: "CPU scheduling algorithms",
  experimentNo: "2",
  experimentName: "Round-robin scheduling",
  teacherName: "Test Teacher",
  teacherDesignation: "Assistant Professor",
  teacherDepartment: "Department of CSE",
  studentName: "Test Student",
  studentId: "241-15-047",
  section: "65_A",
  semester: "Fall 2026",
  studentDepartment: "Department of CSE",
  date: "06/10/2026",
  members: [
    { name: "First Member", id: "241-15-001" },
    { name: "Second Member", id: "241-15-002" },
  ],
};

describe("POST /api/v1/cover-page/{template}/pdf", () => {
  it.each(COVER_PAGE_TEMPLATES)("makes a one-page A4 %s cover", async (t) => {
    const res = await make(t, details);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe(
      `attachment; filename="CSE311-${t}-cover.pdf"`,
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
    const doc = await PDFDocument.load(await res.arrayBuffer());
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual([595, 842]);
  });

  it("leaves blank details blank, and prints text it can't as ?", async () => {
    expect((await make("assignment", {})).status).toBe(200);
    const res = await make("assignment", { studentName: "সৌরভ “Sourov”" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="assignment-cover.pdf"',
    );
  });

  it("refuses unknown templates and over-long details", async () => {
    expect((await make("thesis", details)).status).toBe(422);
    expect((await make("assignment", { topic: "x".repeat(161) })).status).toBe(
      422,
    );
    expect(
      (
        await make("group-assignment", {
          members: Array.from({ length: 7 }, (_, i) => ({
            name: `M${i}`,
            id: "",
          })),
        })
      ).status,
    ).toBe(422);
  });
});

describe("the preview's text widths", () => {
  it("match pdf-lib's Helvetica, so the preview wraps where the PDF does", async () => {
    const { textWidth } = await import("@ourdiu/shared/cover-pages");
    const { StandardFonts } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    // pdf-lib's widths count kerning, which drawing with the standard fonts
    // doesn't apply, so allow a kerning pair's worth.
    const near = (a: number, b: number) =>
      expect(Math.abs(a - b)).toBeLessThan(b * 0.005 + 0.1);
    for (const s of [
      "Operating Systems",
      "Md. Rakib Hossain Sharif 252-35-644",
      "Department of CSE, Daffodil International University!",
    ]) {
      near(textWidth(s, 11, false), regular.widthOfTextAtSize(s, 11));
      near(textWidth(s, 14, true), bold.widthOfTextAtSize(s, 14));
    }
  });
});
