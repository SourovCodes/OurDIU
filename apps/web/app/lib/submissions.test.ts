import type { Submission } from "@ourdiu/shared";
import { describe, expect, it } from "vitest";
import {
  paperDetails,
  paperTitles,
  pickSubmission,
  plural,
} from "./submissions";

const submission = (id: number, status: Submission["status"]): Submission => ({
  id,
  status,
  fileSize: 1000,
  createdAt: "2026-01-01T00:00:00.000Z",
  likeCount: 0,
  dislikeCount: 0,
  viewCount: 0,
  section: null,
  batch: null,
  uploader: null,
  fileUrl: status === "published" ? `/api/v1/submissions/${id}/file` : null,
  text: null,
});

const submissions = [
  submission(1, "published"),
  submission(2, "published"),
  submission(3, "pending_review"),
  submission(4, "rejected"),
];

describe("pickSubmission", () => {
  it("defaults to the first (best ranked) published submission", () => {
    expect(pickSubmission(submissions, null)?.id).toBe(1);
  });

  it("selects the requested published submission", () => {
    expect(pickSubmission(submissions, "2")?.id).toBe(2);
  });

  it.each(["3", "4", "999", "nope"])(
    "falls back when %s is not a published submission",
    (id) => {
      expect(pickSubmission(submissions, id)?.id).toBe(1);
    },
  );

  it("returns null when nothing is published", () => {
    expect(pickSubmission(submissions.slice(2), null)).toBeNull();
  });
});

describe("plural", () => {
  it("pluralises by count", () => {
    expect(plural(1, "paper")).toBe("1 paper");
    expect(plural(2, "paper")).toBe("2 papers");
  });
});

describe("paperDetails", () => {
  it.each([
    [{ section: "5A", batch: "61" }, "Section 5A · Batch 61"],
    [{ section: null, batch: "61" }, "Batch 61"],
    [{ section: null, batch: null }, null],
  ])("%j → %s", (value, expected) => {
    expect(paperDetails(value)).toBe(expected);
  });
});

describe("paperTitles", () => {
  const paper = (
    id: number,
    batch: string | null,
    uploader: string | null,
  ) => ({
    id,
    section: null,
    batch,
    uploader: uploader
      ? { id: uploader, username: uploader, name: uploader, image: null }
      : null,
  });

  it("keeps distinct titles as they are", () => {
    const titles = paperTitles([paper(1, "61", "Jane"), paper(2, "62", "Sam")]);
    expect([...titles.values()]).toEqual(["Batch 61", "Batch 62"]);
  });

  it("adds the uploader to clashing details, then numbers what still clashes", () => {
    const titles = paperTitles([
      paper(1, "65", "Jane"),
      paper(2, "65", "Sam"),
      paper(3, null, null),
      paper(4, "65", "Sam"),
    ]);
    expect([...titles.values()]).toEqual([
      "Batch 65 · Jane",
      "Batch 65 · Sam (1)",
      "Paper 3",
      "Batch 65 · Sam (2)",
    ]);
  });
});
