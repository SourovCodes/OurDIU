import {
  CalendarClock,
  Download,
  ExternalLink,
  Smartphone,
} from "lucide-react";
import { ExamShape } from "~/components/exam-badge";
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
    <Button variant={primary ? "default" : "outline"} asChild>
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
        <h1 className="font-display-xl text-5xl text-balance">
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
    <article className="mx-auto max-w-3xl space-y-6 py-2 sm:py-6">
      <header className="relative space-y-5 overflow-hidden rounded-[2rem] bg-primary p-7 text-primary-foreground sm:p-10">
        <ExamShape
          kind="final"
          colored={false}
          className="absolute -top-10 -right-10 size-56 text-primary-foreground/15"
        />
        <span className="relative inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1 text-sm font-medium">
          <Smartphone className="size-4" aria-hidden />
          Android · Early access
        </span>
        <h1 className="relative font-display-xl text-4xl text-balance sm:text-6xl">
          Test the OurDIU app before everyone else
        </h1>
        <p className="relative max-w-xl text-lg text-pretty opacity-90">
          Papers in your pocket: save them for exam week, read them full screen
          and share one straight from your camera. Google needs 12 testers
          before it can go on the Play Store; three steps, about a minute.
        </p>
      </header>

      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map(({ title, body, action }, index) => (
          <li
            key={title}
            className="flex flex-col gap-4 rounded-[1.75rem] bg-surface p-6"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-primary-container font-expressive text-lg text-primary-container-foreground">
              {index + 1}
            </span>
            <div className="flex-1 space-y-1">
              <h2 className="font-expressive text-xl">{title}</h2>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
            <div>{action}</div>
          </li>
        ))}
      </ol>

      <p className="flex gap-3 rounded-3xl bg-primary-container p-5 text-sm text-primary-container-foreground">
        <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <span className="font-medium">Keep it installed for 14 days.</span>{" "}
          <span className="opacity-85">
            Google only counts testers who stay for two weeks. Found a problem?
            Tell us from Account → Send feedback in the app.
          </span>
        </span>
      </p>

      <section className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="space-y-1 rounded-3xl bg-surface p-5">
          <h2 className="font-semibold">“App not available” on Google Play?</h2>
          <p className="text-muted-foreground">
            Join the group with the same Google account your Play Store uses,
            then open the testing page again.
          </p>
        </div>
        <div className="space-y-1 rounded-3xl bg-surface p-5">
          <h2 className="font-semibold">On iPhone?</h2>
          <p className="text-muted-foreground">
            The app is Android only for now. Everything is on ourdiu.com too.
          </p>
        </div>
      </section>
    </article>
  );
}
