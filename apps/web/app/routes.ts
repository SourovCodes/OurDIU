import { type RouteConfig, index, route } from "@react-router/dev/routes";

// Platform pages at the root, each product under its own path (docs/PLAN.md).
export default [
  // The hub: "What do you need?"
  index("routes/home.tsx"),

  // Question Bank.
  route("questions", "routes/questions-home.tsx"),
  route("questions/browse", "routes/questions.tsx"),
  route("questions/search-index", "routes/questions-search-index.ts"),
  route("questions/search", "routes/questions-search.tsx"),
  route("questions/saved", "routes/questions-saved.tsx"),
  route("questions/exam-papers", "routes/questions-exam-papers.ts"),
  route("questions/departments", "routes/questions-departments.tsx"),
  route("questions/departments/:id", "routes/questions-department.tsx"),
  route("questions/courses/:id", "routes/questions-course.tsx"),
  route("questions/:id", "routes/question.tsx"),
  route("questions/contributors", "routes/contributors.tsx"),
  route("questions/contributors/:username", "routes/contributor.tsx"),
  route("questions/contribute", "routes/contribute.tsx"),
  route("questions/my-submissions", "routes/account-submissions.tsx"),
  route("questions/my-submissions/:id", "routes/account-submission.tsx"),
  // What became of diuqbank.com. At the root: /questions/* links open the app.
  route("diuqbank", "routes/diuqbank.tsx"),
  // For students applying to DIU. At the root too, for the same reason.
  route("admission", "routes/admission.tsx"),

  // Class Routine.
  route("routine", "routes/routine.tsx"),
  route("routine/:department", "routes/routine-sections.tsx"),
  route("routine/:department/teachers", "routes/routine-teachers.tsx"),
  route("routine/:department/teachers/:initials", "routes/routine-teacher.tsx"),
  route("routine/:department/:section", "routes/routine-section.tsx"),

  // Coming soon.
  route("cover-page", "routes/cover-page.tsx"),
  route("market", "routes/market.tsx"),

  // Platform.
  route("app", "routes/app.tsx"),
  route("about", "routes/about.tsx"),
  route("contact", "routes/contact.tsx"),
  route("privacy", "routes/privacy.tsx"),
  route("terms", "routes/terms.tsx"),
  route("copyright", "routes/copyright.tsx"),
  route("cookies", "routes/cookies.tsx"),
  route("delete-account", "routes/delete-account.tsx"),
  route("account", "routes/account.tsx", [index("routes/account-profile.tsx")]),
  route("admin", "routes/admin.tsx", [
    index("routes/admin-dashboard.tsx"),
    route("questions/submissions", "routes/admin-submissions.tsx"),
    route("questions/submissions/:id", "routes/admin-submission.tsx"),
    route("questions/reports", "routes/admin-reports.tsx"),
    route("questions/catalog", "routes/admin-catalog.tsx"),
    route("routine/versions", "routes/admin-routine-versions.tsx"),
    route("routine/versions/:id", "routes/admin-routine-version.tsx"),
    route("routine/courses", "routes/admin-routine-courses.tsx"),
    route("routine/teachers", "routes/admin-routine-teachers.tsx"),
    route("users", "routes/admin-users.tsx"),
  ]),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("sitemap.xml", "routes/sitemap.ts"),
  route("robots.txt", "routes/robots.ts"),
  route("llms.txt", "routes/llms.ts"),
  route(".well-known/assetlinks.json", "routes/assetlinks.ts"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
