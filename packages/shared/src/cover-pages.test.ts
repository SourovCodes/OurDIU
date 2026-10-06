import { describe, expect, it } from "vitest";
import { departmentOfStudentId } from "./constants";
import {
  A4_WIDTH,
  coverPageLayout,
  coverPagePath,
  dhakaDate,
  printableText,
  semesterOn,
  textWidth,
  wrapLines,
  type CoverPageItem,
} from "./cover-pages";

const texts = (items: CoverPageItem[]) =>
  items.flatMap((i) => (i.kind === "text" ? [i] : []));

describe("coverPageLayout", () => {
  it("prints each template's heading and details", () => {
    const assignment = texts(
      coverPageLayout("assignment", {
        courseCode: "CSE311",
        topic: "CPU scheduling",
        studentId: "241-15-047",
      }),
    ).map((t) => t.text);
    expect(assignment).toContain("ASSIGNMENT");
    expect(assignment).toContain("CSE311");
    expect(assignment).toContain("CPU scheduling");
    expect(assignment).toContain("241-15-047");
    expect(assignment).toContain("Date of Submission: ");

    const lab = texts(
      coverPageLayout("lab-report", { experimentName: "Round robin" }),
    ).map((t) => t.text);
    expect(lab).toContain("LAB REPORT");
    expect(lab).toContain("Experiment Name: ");
    expect(lab).not.toContain("Topic Name: ");

    const final = texts(coverPageLayout("final-lab-report", {})).map(
      (t) => t.text,
    );
    expect(final).toContain("FINAL LAB REPORT");
    expect(final).not.toContain("Topic Name: ");
    expect(final).not.toContain("Experiment Name: ");

    const presentation = texts(
      coverPageLayout("presentation", { topic: "Cloud computing" }),
    ).map((t) => t.text);
    expect(presentation).toContain("PRESENTATION");
    expect(presentation).toContain("Cloud computing");
  });

  it("gives each template its page, the assignment's at the maker's home", () => {
    expect(coverPagePath("assignment")).toBe("/cover-page");
    expect(coverPagePath("lab-report")).toBe("/cover-page/lab-report");
  });

  it("keeps every line inside the frame, wrapping long titles", () => {
    const long = "A very long course title ".repeat(8).trim();
    const items = texts(
      coverPageLayout("assignment", { courseTitle: long, teacherName: long }),
    );
    for (const t of items) {
      expect(t.x).toBeGreaterThanOrEqual(22);
      expect(t.x + textWidth(t.text, t.size, t.bold)).toBeLessThanOrEqual(
        A4_WIDTH - 22,
      );
    }
    // At most two lines of the title.
    expect(items.filter((t) => long.startsWith(t.text)).length).toBe(2);
  });

  it("lists up to six group members", () => {
    const members = Array.from({ length: 8 }, (_, i) => ({
      name: `Member ${i + 1}`,
      id: `241-15-00${i + 1}`,
    }));
    const shown = texts(coverPageLayout("group-assignment", { members })).map(
      (t) => t.text,
    );
    expect(shown).toContain("Member 6");
    expect(shown).not.toContain("Member 7");
    expect(shown).toContain("241-15-006");
  });
});

describe("text", () => {
  it("prints only what the standard fonts can", () => {
    expect(printableText("  “Hi” – it’s  me…\n")).toBe('"Hi" - it\'s me...');
    expect(printableText("সৌরভ Sourov")).toBe("???? Sourov");
  });

  it("wraps at the width, cutting words too long for a line", () => {
    const lines = wrapLines("one two three four five six", 12, false, 60);
    for (const line of lines) {
      expect(textWidth(line, 12, false)).toBeLessThanOrEqual(60);
    }
    expect(lines.join(" ")).toBe("one two three four five six");
    expect(wrapLines("x".repeat(40), 12, false, 50).length).toBeGreaterThan(1);
  });
});

describe("dates", () => {
  it("names DIU's term and the date in Dhaka", () => {
    expect(semesterOn(new Date("2026-01-10T00:00:00Z"))).toBe("Spring 2026");
    expect(semesterOn(new Date("2026-06-10T00:00:00Z"))).toBe("Summer 2026");
    expect(semesterOn(new Date("2026-10-06T00:00:00Z"))).toBe("Fall 2026");
    // 31 December 20:00 UTC is already 1 January in Dhaka.
    expect(semesterOn(new Date("2026-12-31T20:00:00Z"))).toBe("Spring 2027");
    expect(dhakaDate(new Date("2026-10-05T20:00:00Z"))).toBe("06/10/2026");
  });
});

describe("departmentOfStudentId", () => {
  it("reads the department from either ID format", () => {
    expect(departmentOfStudentId("241-15-047")).toBe("CSE");
    expect(departmentOfStudentId("262-35-490")).toBe("SWE");
    expect(departmentOfStudentId("0242220005101255")).toBe("CSE");
    expect(departmentOfStudentId("241-99-047")).toBeNull();
    expect(departmentOfStudentId("nope")).toBeNull();
  });
});
