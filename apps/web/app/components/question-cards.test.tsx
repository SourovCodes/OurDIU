import type { Question } from "@ourdiu/shared";
import { cleanup, render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, expect, it } from "vitest";
import { QuestionCards } from "./question-cards";

afterEach(cleanup);

const question: Question = {
  id: 7,
  department: {
    id: 1,
    name: "Computer Science and Engineering",
    shortName: "CSE",
  },
  course: { id: 3, name: "Data Structures" },
  semester: { id: 2, name: "Summer 24" },
  examType: { id: 1, name: "Midterm" },
  submissionCounts: { published: 2, pendingReview: 1, rejected: 0 },
  viewCount: 1234,
  viewsToday: null,
};

async function renderCard(q: Question) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <QuestionCards questions={[q]} /> },
  ]);
  render(<Stub initialEntries={["/"]} />);
  const link = await screen.findByRole("link", { name: "Data Structures" });
  return { link, card: link.closest("li")! };
}

it("links to the question and summarises its submissions and views", async () => {
  const { link, card } = await renderCard(question);
  expect(link.getAttribute("href")).toBe("/questions/7");
  for (const text of ["CSE", "Midterm", "Summer 24", "2 papers", "1.2K"]) {
    expect(card.textContent).toContain(text);
  }
  expect(within(card).getByTitle("1 waiting for review")).toBeTruthy();
});

it("shows when only pending submissions exist", async () => {
  const { card } = await renderCard({
    ...question,
    submissionCounts: { published: 0, pendingReview: 1, rejected: 0 },
  });
  expect(card.textContent).toContain("No papers yet");
});
