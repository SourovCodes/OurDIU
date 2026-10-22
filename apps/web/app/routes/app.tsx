import { Download } from "lucide-react";
import { Button } from "~/components/ui/button";
import { PLAY_STORE_URL } from "~/lib/android-app";
import type { Route } from "./+types/app";
import { NARROW_PAGE } from "~/components/page-header";
import { cn } from "~/lib/utils";

export const meta: Route.MetaFunction = () => [
  { title: "The OurDIU Android app — OurDIU" },
  {
    name: "description",
    content: "Get the OurDIU app for Android on Google Play.",
  },
];

export default function AndroidApp() {
  return (
    <article className={cn(NARROW_PAGE, "space-y-4 py-4 sm:py-10")}>
      <h1 className="font-display-xl text-5xl text-balance">
        The OurDIU app for Android
      </h1>
      <p className="text-muted-foreground">
        Past question papers on your phone: find, read, save and share them.
      </p>
      <Button asChild>
        <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
          <Download />
          Get it on Google Play
        </a>
      </Button>
    </article>
  );
}
