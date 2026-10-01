import type { MySubmission } from "@ourdiu/shared";
import { proposesNewEntries } from "./submissions";

export type ReviewStage = {
  /** Short label for a card, e.g. "Checking your paper". */
  label: string;
  /** One or two sentences for the status page. */
  description: string;
  tone: "progress" | "success" | "attention" | "neutral";
};

/** Where an uploader's paper is in the review, in plain words. */
export function reviewStage(submission: MySubmission): ReviewStage {
  const { status, analysis, autoPublished, rejectionReason } = submission;

  if (status === "published") {
    return autoPublished
      ? {
          label: "Published automatically",
          description:
            "The AI check confirmed it’s a single question paper and read the same department, course, semester and exam type you chose, so it was published right away.",
          tone: "success",
        }
      : {
          label: "Published by an admin",
          description: "An admin reviewed your paper and published it.",
          tone: "success",
        };
  }
  if (status === "rejected") {
    return {
      label: "Rejected",
      description: rejectionReason
        ? `An admin didn’t publish your paper: ${rejectionReason} You can withdraw it and upload a corrected one.`
        : "An admin reviewed your paper and didn’t publish it. You can withdraw it and upload a corrected one.",
      tone: "neutral",
    };
  }

  if (analysis?.status === "queued" || analysis?.status === "processing") {
    return {
      label: "Checking your paper",
      description:
        "The AI is reading your paper. This usually takes under a minute.",
      tone: "progress",
    };
  }
  if (analysis?.status === "completed") {
    if (analysis.flag === "not_a_paper") {
      return {
        label: "Waiting for an admin",
        description:
          "The AI doesn’t think this file is an exam question paper. An admin will take a look.",
        tone: "attention",
      };
    }
    if (analysis.flag === "multiple_papers") {
      return {
        label: "Waiting for an admin",
        description:
          "The AI found more than one question paper in this file. Each paper should be uploaded on its own; an admin will take a look.",
        tone: "attention",
      };
    }
    if (proposesNewEntries(submission.classification)) {
      return {
        label: "Waiting for an admin",
        description:
          "Your paper adds a new department, course or semester, which an admin has to approve before it’s published.",
        tone: "neutral",
      };
    }
    if (analysis.matches === false) {
      return {
        label: "Check your details",
        description:
          "The AI read different details from the paper than the ones you chose. Use the AI’s details or correct yours to publish it now; otherwise an admin will check.",
        tone: "attention",
      };
    }
  }
  return {
    label: "Waiting for an admin",
    description: "An admin will review your paper soon.",
    tone: "neutral",
  };
}

export const isChecking = (submission: MySubmission) =>
  submission.status === "pending_review" &&
  (submission.analysis?.status === "queued" ||
    submission.analysis?.status === "processing");
