import { QB_NAME } from "./seo";

/**
 * The question bank's move from diuqbank.com (docs/PLAN.md, decisions 18 and 19),
 * told once for /diuqbank, its FAQ markup and /llms.txt, so they never disagree.
 */
export const MOVE_PATH = "/diuqbank";
export const MOVE_DATE = "1 October 2026";
export const MOVE_DATE_ISO = "2026-10-01";

/** The old site's names, as students and Google knew it. */
export const OLD_NAMES = ["DIU QBank", "diuqbank.com", "QuestionBank"];

/** Where the old site's pages are now. */
export const ADDRESS_CHANGES = [
  { from: "diuqbank.com", to: "ourdiu.com/questions" },
  { from: "diuqbank.com/questions", to: "ourdiu.com/questions/browse" },
  { from: "diuqbank.com/questions/…", to: "ourdiu.com/questions/…" },
  {
    from: "diuqbank.com/contributors",
    to: "ourdiu.com/questions/contributors",
  },
  { from: "diuqbank.com/contribute", to: "ourdiu.com/questions/contribute" },
] as const;

export const MOVE_FAQ = [
  {
    question: "What happened to diuqbank.com?",
    answer: `On ${MOVE_DATE}, DIU QBank (diuqbank.com) moved to ourdiu.com/questions and became the ${QB_NAME} on OurDIU. Every page of diuqbank.com now redirects to the same page on ourdiu.com, so old links and bookmarks keep working.`,
  },
  {
    question: "Why did the DIU Question Bank move to OurDIU?",
    answer:
      "OurDIU brings tools for Daffodil International University students together in one place. The question bank is the first; a class routine and a student marketplace are coming. One site and one app instead of a separate one for each.",
  },
  {
    question: "Are all the question papers still there?",
    answer:
      "Yes. Every question paper, course, department and contributor was copied over, and the paper pages kept their numbers: diuqbank.com/questions/123 is now ourdiu.com/questions/123.",
  },
  {
    question: "Do I need a new account?",
    answer:
      "No. Sign in with the same Google account as before; your profile, the papers you shared and your saved papers are all on OurDIU.",
  },
  {
    question: "Is it still free?",
    answer:
      "Yes. The DIU Question Bank is free to read and download, with no ads and no sign-up needed to read papers, and it will stay that way.",
  },
  {
    question: "Does the old app still work?",
    answer:
      "Yes, copies of the app already installed keep working. The new OurDIU app for Android replaces it; it is in testing, and anyone can join from ourdiu.com/app.",
  },
  {
    question: "Who runs OurDIU?",
    answer:
      "Sourov Biswas, who started the question bank as a DIU student in 2024 and still runs both. Papers are shared by DIU students and checked before they are published.",
  },
] as const;
