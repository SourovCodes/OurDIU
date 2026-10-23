import { Download } from "lucide-react";
import { SpaceIcon } from "~/components/space-icon";
import { Button } from "~/components/ui/button";
import { PLAY_STORE_URL } from "~/lib/android-app";
import { product } from "~/lib/products";
import { androidAppJsonLd, originOf, pageMeta, QB_NAME } from "~/lib/seo";
import type { Route } from "./+types/app";
import { NARROW_PAGE } from "~/components/page-header";
import { cn } from "~/lib/utils";

export const meta: Route.MetaFunction = ({ matches }) => [
  ...pageMeta({
    title: `${QB_NAME} and Class Routine app for Android | OurDIU`,
    description:
      "The free OurDIU app for Daffodil International University (DIU) students: past question papers, your class routine with home screen widgets, and cover pages. Get it on Google Play.",
  }),
  androidAppJsonLd(originOf(matches)),
];

/** What each product does in the app, beyond what the website does. */
const FEATURES = [
  {
    product: product("questions"),
    body: "Find previous final, midterm and quiz papers, save them for exam week and read them full screen. Share a paper by scanning it with your camera.",
  },
  {
    product: product("routine"),
    body: "Today’s classes and your section’s week for CSE, EEE and SWE, offline once your section is set, with home screen widgets.",
  },
  {
    product: product("cover"),
    body: "Pick the course and the teacher is filled in from the routine; share the cover page as a PDF or a Word file.",
  },
];

export default function AndroidApp() {
  return (
    <article className={cn(NARROW_PAGE, "space-y-8 py-4 sm:py-10")}>
      <header className="space-y-4">
        <h1 className="font-display-xl text-5xl text-balance">
          The OurDIU app for Android
        </h1>
        <p className="text-lg text-pretty text-muted-foreground">
          For Daffodil International University students: free, without ads.
        </p>
        <Button size="lg" asChild>
          <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
            <Download />
            Get it on Google Play
          </a>
        </Button>
      </header>

      <ul className="space-y-3">
        {FEATURES.map(({ product, body }) => (
          <li
            key={product.id}
            className="flex gap-4 rounded-[1.75rem] bg-surface p-5"
          >
            <SpaceIcon product={product} size={48} />
            <div className="min-w-0 space-y-1">
              <h2 className="font-expressive text-xl">{product.title}</h2>
              <p className="text-sm text-pretty text-muted-foreground">
                {body}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-sm text-muted-foreground">
        Android only for now; on iPhone, everything is on ourdiu.com.
      </p>
    </article>
  );
}
