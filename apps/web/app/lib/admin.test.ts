import type { SubmissionClassification } from "@ourdiu/shared";
import { describe, expect, it } from "vitest";
import { classificationLine, proposesNewEntries } from "./admin";

const existing: SubmissionClassification = {
  department: { id: 1, name: "Computer Science", shortName: "CSE" },
  course: { id: 2, name: "Algorithms" },
  semester: { id: 3, name: "Fall 24" },
  examType: { id: 4, name: "Final" },
};

describe("proposesNewEntries", () => {
  it("is true while any value is a new name", () => {
    expect(proposesNewEntries(existing)).toBe(false);
    expect(
      proposesNewEntries({
        ...existing,
        semester: { id: null, name: "Short 25" },
      }),
    ).toBe(true);
  });
});

describe("classificationLine", () => {
  it("prefers the department's short name", () => {
    expect(classificationLine(existing)).toBe("CSE · Fall 24 · Final");
    expect(
      classificationLine({
        ...existing,
        department: { id: null, name: "Marine Science", shortName: null },
      }),
    ).toBe("Marine Science · Fall 24 · Final");
  });
});
