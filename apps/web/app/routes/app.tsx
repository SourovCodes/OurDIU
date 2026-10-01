import {
  CalendarClock,
  Download,
  ExternalLink,
  Smartphone,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  ANDROID_BETA,
  PLAY_STORE_URL,
  PLAY_TESTING_URL,
  TESTER_GROUP_URL,
} from "~/lib/android-app";
import type { Route } from "./+types/app";

export const meta: Route.MetaFunction = () => [
  {
    title: ANDROID_BETA
      ? "Test the OurDIU Android app — OurDIU"
      : "The OurDIU Android app — OurDIU",
  },
  {
    name: "description",
    content: ANDROID_BETA
      ? "Become a tester of the OurDIU app for Android: join the tester group, opt in on Google Play and install it."
      : "Get the OurDIU app for Android on Google Play.",
  },
];

/** An external link styled as a button; opens in a new tab. */
function ExternalButton({
  href,
  primary = false,
  children,
}: {
  href: string;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button size="sm" variant={primary ? "default" : "outline"} asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    </Button>
  );
}

const STEPS = [
  {
    title: "Join the tester group",
    body: "Use the Google account that your phone’s Play Store uses.",
    action: (
      <ExternalButton href={TESTER_GROUP_URL} primary>
        Join the group
        <ExternalLink />
      </ExternalButton>
    ),
  },
  {
    title: "Become a tester",
    body: "On Google Play’s page, tap “Become a tester”.",
    action: (
      <ExternalButton href={PLAY_TESTING_URL}>
        Open the testing page
        <ExternalLink />
      </ExternalButton>
    ),
  },
  {
    title: "Install the app",
    body: "It can take a few minutes to show up after you opt in.",
    action: (
      <ExternalButton href={PLAY_STORE_URL}>
        <Download />
        Get it on Google Play
      </ExternalButton>
    ),
  },
];

export default function AndroidApp() {
  if (!ANDROID_BETA) {
    return (
      <article className="mx-auto max-w-xl space-y-4 py-4 sm:py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          The OurDIU app for Android
        </h1>
        <p className="text-muted-foreground">
          Past question papers on your phone: find, read, save and share them.
        </p>
        <ExternalButton href={PLAY_STORE_URL} primary>
          <Download />
          Get it on Google Play
        </ExternalButton>
      </article>
    );
  }

  return (
    <article className="mx-auto max-w-xl space-y-8 py-4 sm:py-10">
      <header className="space-y-3">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          <Smartphone />
          Android · Early access
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Test the OurDIU app before everyone else
        </h1>
        <p className="text-lg text-pretty text-muted-foreground">
          Google needs 12 testers before the app can go on the Play Store. Three
          steps, about a minute.
        </p>
      </header>

      <ol className="space-y-3">
        {STEPS.map(({ title, body, action }, index) => (
          <li key={title} className="flex gap-4 rounded-xl border p-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-muted text-sm font-medium">
              {index + 1}
            </span>
            <div className="grid gap-3">
              <div className="space-y-0.5">
                <h2 className="font-medium">{title}</h2>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
              <div>{action}</div>
            </div>
          </li>
        ))}
      </ol>

      <p className="flex gap-3 rounded-xl bg-muted/60 p-4 text-sm">
        <CalendarClock
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span>
          <span className="font-medium">Keep it installed for 14 days.</span>{" "}
          <span className="text-muted-foreground">
            Google only counts testers who stay for two weeks. Found a problem?
            Tell us from Account → Send feedback in the app.
          </span>
        </span>
      </p>

      <section className="space-y-4 text-sm">
        <div className="space-y-1">
          <h2 className="font-medium">“App not available” on Google Play?</h2>
          <p className="text-muted-foreground">
            Join the group with the same Google account your Play Store uses,
            then open the testing page again.
          </p>
        </div>
        <div className="space-y-1">
          <h2 className="font-medium">On iPhone?</h2>
          <p className="text-muted-foreground">
            The app is Android only for now. Everything is on ourdiu.com too.
          </p>
        </div>
      </section>
    </article>
  );
}
