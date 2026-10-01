import type { MySubmission } from "@ourdiu/shared";
import { describe, expect, it } from "vitest";
import { isChecking, reviewStage } from "./review";

const base: MySubmission = {
  id: 1,
  status: "pending_review",
  fileSize: 1000,
  createdAt: "2026-09-01T00:00:00.000Z",
  section: null,
  batch: null,
  questionId: 1,
  likeCount: 0,
  dislikeCount: 0,
  viewCount: 0,
  classification: {
    department: {
      id: 1,
      name: "Computer Science and Engineering",
      shortName: "CSE",
    },
    course: { id: 2, name: "Algorithms" },
    semester: { id: 3, name: "Fall 25" },
    examType: { id: 4, name: "Final" },
  },
  autoPublished: false,
  rejectionReason: null,
  analysis: { status: "completed", flag: null, matches: true },
};

describe("reviewStage", () => {
  it("tells auto-published papers from admin decisions", () => {
    expect(
      reviewStage({ ...base, status: "published", autoPublished: true }).label,
    ).toBe("Published automatically");
    expect(reviewStage({ ...base, status: "published" }).label).toBe(
      "Published by an admin",
    );
    expect(reviewStage({ ...base, status: "rejected" }).label).toBe("Rejected");
    expect(
      reviewStage({
        ...base,
        status: "rejected",
        rejectionReason: "This file is not a valid exam question paper.",
      }).description,
    ).toContain("This file is not a valid exam question paper.");
  });

  it("explains why a paper waits for an admin", () => {
    const stage = (analysis: MySubmission["analysis"]) =>
      reviewStage({ ...base, analysis });
    expect(
      stage({ status: "processing", flag: null, matches: null }).tone,
    ).toBe("progress");
    expect(
      stage({ status: "completed", flag: "multiple_papers", matches: true })
        .description,
    ).toMatch(/more than one question paper/);
    expect(
      stage({ status: "completed", flag: null, matches: false }).description,
    ).toMatch(/different details/);
    expect(stage(null).description).toMatch(/admin will review/);
  });

  it("mentions new entries awaiting approval", () => {
    const proposal = {
      ...base,
      questionId: null,
      classification: {
        ...base.classification,
        course: { id: null, name: "Compilers" },
      },
    };
    expect(reviewStage(proposal).description).toMatch(/has to approve/);
  });
});

describe("isChecking", () => {
  it("is true while a pending paper's check runs", () => {
    expect(
      isChecking({
        ...base,
        analysis: { status: "queued", flag: null, matches: null },
      }),
    ).toBe(true);
    expect(isChecking(base)).toBe(false);
  });
});
