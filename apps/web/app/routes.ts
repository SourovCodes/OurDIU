import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("routine", "routes/routine.tsx"),
  route("market", "routes/market.tsx"),
  route("privacy", "routes/privacy.tsx"),
  route("terms", "routes/terms.tsx"),
  route("account", "routes/account.tsx"),
  route("admin", "routes/admin.tsx", [
    index("routes/admin-index.tsx"),
    route("users", "routes/admin-users.tsx"),
    route("departments", "routes/admin-departments.tsx"),
  ]),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("robots.txt", "routes/robots.ts"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
