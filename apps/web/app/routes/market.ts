import { redirect } from "react-router";

/**
 * The Marketplace was dropped (docs/PLAN.md, decision 54); its "coming soon"
 * page sends old links and bookmarks to the hub.
 */
export function loader() {
  return redirect("/", 301);
}
