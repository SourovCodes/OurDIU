import { redirect } from "react-router";

/** ourdiu.com/myslide: the owner's slide deck, a static file in public/files. */
export function loader() {
  return redirect("/files/structure-vs-behavior.pptx", 302);
}
