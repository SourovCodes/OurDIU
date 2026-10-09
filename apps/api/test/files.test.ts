import { describe, expect, it } from "vitest";
import { inlineDisposition, paperFileName } from "../src/lib/files";

describe("paperFileName", () => {
  it("names a paper by its course, exam and semester", () => {
    expect(
      paperFileName({
        course: "Data Structures",
        examType: "Final",
        semester: "Fall 25",
      }),
    ).toBe("Data Structures - Final - Fall 25.pdf");
  });

  it("drops characters file systems reject", () => {
    expect(
      paperFileName({
        course: 'C/C++: "Basics"?',
        examType: "Mid*term",
        semester: "Spring\n24",
      }),
    ).toBe("CC++ Basics - Midterm - Spring24.pdf");
  });
});

describe("inlineDisposition", () => {
  it("shows the file and names it", () => {
    expect(inlineDisposition("Data Structures - Final - Fall 25.pdf")).toBe(
      "inline; filename=\"Data Structures - Final - Fall 25.pdf\"; filename*=UTF-8''Data%20Structures%20-%20Final%20-%20Fall%2025.pdf",
    );
  });

  it("keeps non-ASCII names in filename*, with an ASCII fallback", () => {
    expect(inlineDisposition("Café (Theory).pdf")).toBe(
      "inline; filename=\"Cafe (Theory).pdf\"; filename*=UTF-8''Caf%C3%A9%20%28Theory%29.pdf",
    );
  });
});
