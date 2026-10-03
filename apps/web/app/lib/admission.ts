/**
 * The admission guide (/admission, docs/PLAN.md decision 23): facts about getting into
 * DIU, told once for the page and its FAQ markup. Everything here comes from DIU's own
 * pages (`ADMISSION_SOURCES`); check them again and update `ADMISSION_CHECKED` when
 * editing, as dates, fees and rules change every semester.
 */
export const ADMISSION_PATH = "/admission";
export const ADMISSION_CHECKED = "3 October 2026";
export const ADMISSION_CHECKED_ISO = "2026-10-03";

export const ADMISSION_PORTAL = "https://admission.daffodilvarsity.edu.bd";
export const ADMISSION_PHONE = "09617901212";
export const ADMISSION_EMAIL = "admission@daffodilvarsity.edu.bd";

export const ADMISSION_SOURCES = [
  {
    label: "DIU admission portal: apply and see the test schedule",
    href: ADMISSION_PORTAL,
  },
  {
    label: "Admission portal FAQ",
    href: `${ADMISSION_PORTAL}/faq`,
  },
  {
    label: "DIU FAQ (Admission)",
    href: "https://daffodilvarsity.edu.bd/faq",
  },
  {
    label: "Admission schedule",
    href: "https://daffodilvarsity.edu.bd/admission/schedule",
  },
  {
    label: "Tuition fees",
    href: "https://daffodilvarsity.edu.bd/tuition-fees",
  },
  {
    label: "Waiver calculator",
    href: "https://daffodilvarsity.edu.bd/tuition-fee-calculator",
  },
  {
    label: "Scholarships and waivers",
    href: "https://daffodilvarsity.edu.bd/scholarship",
  },
] as const;

/** The three semesters; each has its own application deadline. */
export const SEMESTERS = [
  { name: "Spring", months: "January to April" },
  { name: "Summer", months: "May to August" },
  { name: "Fall", months: "September to December" },
] as const;

/** Admission test times by faculty, as DIU's admission FAQ lists them. */
export const TEST_SLOTS = [
  { faculty: "Science and Information Technology", time: "9:00 to 10:00 am" },
  { faculty: "Humanities and Social Sciences", time: "9:00 to 10:00 am" },
  { faculty: "Business and Entrepreneurship", time: "11:00 am to 12:00 pm" },
  { faculty: "Health and Life Sciences", time: "11:00 am to 12:00 pm" },
  { faculty: "Engineering", time: "2:30 to 3:30 pm" },
] as const;

export const APPLY_STEPS = [
  {
    title: "Check that you can apply",
    text: "Look up your program's requirements below. You need your HSC (or equivalent) result first: applications aren't taken before it is published.",
  },
  {
    title: "Apply online",
    text: `Create an account on the admission portal (${ADMISSION_PORTAL.replace("https://", "")}) and apply for a faculty's admission test. You can choose several programs within a faculty and apply to up to three faculties, as long as their test times don't clash. Pay the application fee online or in cash.`,
  },
  {
    title: "Get your admit card",
    text: "The admission office checks your eligibility again and emails you: either your admit card for the test, or that a department recommends you for admission directly.",
  },
  {
    title: "Sit the admission test",
    text: "The test takes one hour, at your faculty's time on the test day. Bring your admit card.",
  },
  {
    title: "Get admitted",
    text: "Submit your documents and pay the admission fees, then register for your first semester's courses with your department.",
  },
] as const;

export const ELIGIBILITY = [
  "At least GPA 2.50 in both SSC and HSC (or equivalent). This is the usual minimum; each program sets its own requirements, and some ask for more, such as a total GPA of 6.00.",
  "Programs ask for subjects too. Computer Science and Engineering, for example, needs HSC from science with Physics, Mathematics and English; a diploma in Computer Technology with GPA 2.50 in SSC also qualifies.",
  "English medium: five O-level and two A-level subjects, with at least four B grades and three C grades among the seven (no D). CSE needs Physics and Mathematics at both levels.",
  "A gap of at most two years after HSC for bachelor's programs. With a longer gap, ask the admission office.",
] as const;

export const DOCUMENTS = [
  "SSC, Dakhil, O-level or diploma certificate and mark sheet",
  "HSC, Alim, A-level or diploma certificate and mark sheet (diploma: all eight semesters' mark sheets)",
  "Education board copies of certificates and mark sheets; online copies aren't accepted",
  "NID of the student, father and mother (a birth certificate is accepted for a while if you don't have an NID yet)",
  "Two recent formal photos",
  "For a quota-based waiver, the certificates that prove it",
] as const;

export const ADMISSION_FAQ = [
  {
    question:
      "Is there an admission test at Daffodil International University?",
    answer:
      "Yes. You apply online for a faculty's admission test; after the admission office checks your eligibility, it emails you an admit card, or tells you that a department recommends you for admission directly.",
  },
  {
    question: "How long is the DIU admission test, and when is it?",
    answer: `One hour. Each faculty has its own time on the test day: ${TEST_SLOTS.map((s) => `${s.faculty} ${s.time}`).join("; ")}. The dates for each semester are on the admission portal.`,
  },
  {
    question: "What GPA do I need for admission to DIU?",
    answer:
      "Usually at least GPA 2.50 in both SSC and HSC (or equivalent). Programs set their own requirements on top, such as subjects (Physics and Mathematics for CSE) or a total GPA of 6.00.",
  },
  {
    question: "Can I apply for more than one program?",
    answer:
      "Yes. Within a faculty you can choose several programs, and you can apply to up to three faculties if their test times don't clash.",
  },
  {
    question: "Can I apply before my HSC result is published?",
    answer:
      "No. Once the result is out, you can apply with the published online result and hand in the board copies later.",
  },
  {
    question: "When does DIU take new students?",
    answer:
      "Three times a year, for the Spring (January to April), Summer (May to August) and Fall (September to December) semesters, each with its own deadline. A few programs run two semesters a year and take students for Spring and Fall.",
  },
  {
    question: "Are there past DIU admission test questions?",
    answer:
      "Not on OurDIU yet: the DIU Question Bank has the university's midterm and final papers, shared by students. If you have an admission test question paper, send it to us and we'll add it.",
  },
  {
    question: "How do I contact the DIU admission office?",
    answer: `Call the help line ${ADMISSION_PHONE} (8 am to 6 pm on working days) or email ${ADMISSION_EMAIL}.`,
  },
] as const;
