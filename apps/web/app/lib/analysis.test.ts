import type { AnalysisValues, SubmissionClassification } from "@ourdiu/shared";
import { describe, expect, it } from "vitest";
import {
  analysisLabel,
  classificationFields,
  classificationFromAnalysis,
  compareWithAnalysis,
} from "./analysis";

const classification: SubmissionClassification = {
  department: {
    id: 1,
    name: "Computer Science and Engineering",
    shortName: "CSE",
  },
  course: { id: null, name: "Compiler Design & Construction" },
  semester: { id: 3, name: "Spring 25" },
  examType: { id: 1, name: "Midterm" },
};

const values: AnalysisValues = {
  department: {
    id: 1,
    name: "Computer Science and Engineering",
    shortName: "CSE",
  },
  course: { id: null, name: "Compiler Design and Construction" },
  semester: { id: null, name: "Fall 25" },
  examType: { id: null, name: "Quiz" },
  section: "A",
  batch: null,
};

describe("compareWithAnalysis", () => {
  it("marks differences and new AI values, ignoring & vs and", () => {
    const rows = compareWithAnalysis(
      { classification, section: null, batch: "61" },
      values,
    );
    expect(
      rows.map(({ label, differs, aiIsNew, applies }) => [
        label,
        differs,
        aiIsNew,
        applies,
      ]),
    ).toEqual([
      ["Department", false, false, false],
      ["Course", false, true, false],
      ["Semester", true, true, true],
      // New exam types can't be proposed: using the AI's details keeps ours.
      ["Exam type", true, true, false],
      ["Section", true, false, true],
      // Not read by the AI: not a disagreement.
      ["Batch", false, false, false],
    ]);
  });
});

describe("classificationFromAnalysis", () => {
  it("uses the AI's values but keeps an existing exam type", () => {
    expect(classificationFromAnalysis(classification, values)).toEqual({
      department: values.department,
      course: values.course,
      semester: values.semester,
      examType: classification.examType,
    });
  });

  it("keeps values the AI couldn't read", () => {
    const empty = {
      ...values,
      department: null,
      course: null,
      semester: null,
      examType: null,
    };
    expect(classificationFromAnalysis(classification, empty)).toEqual(
      classification,
    );
  });
});

describe("analysisLabel", () => {
  it("puts flags before agreement", () => {
    expect(
      analysisLabel({
        status: "completed",
        flag: "multiple_papers",
        matches: true,
      }).label,
    ).toBe("Multiple papers");
    expect(
      analysisLabel({ status: "completed", flag: null, matches: false }).tone,
    ).toBe("warning");
    expect(
      analysisLabel({ status: "processing", flag: null, matches: null }).label,
    ).toBe("AI checking");
  });
});

describe("classificationFields", () => {
  it("sends ids for existing entries and names for new ones", () => {
    expect(
      classificationFields(classificationFromAnalysis(classification, values), {
        section: "A",
        batch: null,
      }),
    ).toEqual({
      departmentId: "1",
      customCourseName: "Compiler Design and Construction",
      customSemesterName: "Fall 25",
      examTypeId: "1",
      section: "A",
    });
  });
});
