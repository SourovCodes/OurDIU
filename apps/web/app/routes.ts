import { type RouteConfig, index, route } from "@react-router/dev/routes";

// Platform pages at the root, each product under its own path (docs/PLAN.md).
export default [
  // The hub: "What do you need?"
  index("routes/home.tsx"),

  // Question Bank.
  route("questions", "routes/questions-home.tsx"),
  route("questions/browse", "routes/questions.tsx"),
  route("questions/:id", "routes/question.tsx"),
  route("questions/contributors", "routes/contributors.tsx"),
  route("questions/contributors/:username", "routes/contributor.tsx"),
  route("questions/contribute", "routes/contribute.tsx"),
  route("questions/my-submissions", "routes/account-submissions.tsx"),
  route("questions/my-submissions/:id", "routes/account-submission.tsx"),

  // Coming soon.
  route("routine", "routes/routine.tsx"),
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
    route("users", "routes/admin-users.tsx"),
  ]),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("sitemap.xml", "routes/sitemap.ts"),
  route("robots.txt", "routes/robots.ts"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
