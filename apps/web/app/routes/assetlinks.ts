import { assetLinks } from "~/lib/android-app";

/**
 * Lets the OurDIU Android app open ourdiu.com links (App Links). Android fetches
 * it when the app is installed; it must not redirect.
 */
export function loader() {
  return Response.json(assetLinks(), {
    headers: { "cache-control": "public, max-age=3600" },
  });
}
