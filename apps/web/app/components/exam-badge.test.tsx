import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ExamBadge, examKind, examLetters } from "./exam-badge";

afterEach(cleanup);

it("gives each exam type its shape", () => {
  expect(examKind("Final")).toBe("final");
  expect(examKind("Midterm")).toBe("midterm");
  expect(examKind("Quiz")).toBe("quiz");
  expect(examKind("Lab Final")).toBe("lab");
  expect(examKind("Lab Midterm")).toBe("lab");
  expect(examKind("Viva")).toBe("quiz");
});

it("labels the badge with one or two letters", () => {
  expect(examLetters("Final")).toBe("F");
  expect(examLetters("Midterm")).toBe("M");
  expect(examLetters("Quiz")).toBe("Q");
  expect(examLetters("Lab Final")).toBe("LF");
  expect(examLetters("Lab  Midterm")).toBe("LM");
});

it("is announced as the exam type, not its letters", () => {
  render(<ExamBadge examType="Lab Final" />);
  const badge = screen.getByRole("img", { name: "Lab Final" });
  expect(badge.textContent).toBe("LF");
});
