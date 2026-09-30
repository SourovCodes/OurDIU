import { redirect } from "react-router";

/** Nothing to summarise yet: the panel opens on its first page. */
export function loader() {
  return redirect("/admin/users");
}
