import { ArrowRight, Gift, MegaphoneOff, Wrench } from "lucide-react";
import { Link } from "react-router";
import { ContributorAvatar } from "~/components/contributor-avatar";
import { SocialIcon } from "~/components/social-icons";
import { buttonVariants } from "~/components/ui/button";
import { EXAM_TONE, ExamShape } from "~/components/exam-badge";
import { cn } from "~/lib/utils";
import { AUTHOR } from "~/lib/author";
import type { Route } from "./+types/about";
import { NARROW_PAGE } from "~/components/page-header";

export const meta: Route.MetaFunction = () => [
  { title: "About — OurDIU" },
  {
    name: "description",
    content:
      "Who builds OurDIU, and why it will stay free forever with no ads.",
  },
];

const PROMISES = [
  {
    icon: Gift,
    title: "Free forever",
    description: "No paywalls, no sign-up walls, no “premium” papers.",
  },
  {
    icon: MegaphoneOff,
    title: "No ads, ever",
    description: "No banners, no pop-ups, nobody selling your attention.",
  },
  {
    icon: Wrench,
    title: "Looked after",
    description: "I keep fixing, improving and reviewing papers myself.",
  },
];

const PROMISE_TONES = [
  { tone: EXAM_TONE.final, shape: "final" as const },
  { tone: EXAM_TONE.midterm, shape: "midterm" as const },
  { tone: EXAM_TONE.quiz, shape: "quiz" as const },
];

export default function About() {
  return (
    <article className={cn(NARROW_PAGE, "space-y-10 py-2 sm:py-6")}>
      <header className="flex flex-col gap-6 rounded-[2rem] bg-primary-container p-7 text-primary-container-foreground sm:flex-row sm:items-center sm:p-10">
        <ContributorAvatar
          name={AUTHOR.name}
          image={AUTHOR.avatar}
          size="xl"
          className="size-28 text-3xl ring-4 ring-primary/30"
        />
        <div className="space-y-2">
          <h1 className="font-display-xl text-5xl sm:text-6xl">
            Hi, I’m {AUTHOR.firstName} 👋
          </h1>
          <p className="text-lg opacity-85">
            I built OurDIU, and I keep it running.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 text-lg leading-8 text-pretty">
        <p>
          OurDIU started as the question bank, a side project: one place for
          past papers, so nobody has to scroll through five group chats the
          night before an exam.
        </p>
        <p>
          It turned out to be the best teacher I’ve had. Building and
          maintaining it (sign-in, uploads, reviews, the occasional 2 a.m. bug
          fix) taught me more than any course, and gave me the confidence to
          apply for real developer jobs. Reader, I got one. 🎉
        </p>
        <p>
          That job pays my bills now, so this site doesn’t have to. It just gets
          to be useful.
        </p>
      </div>

      <section aria-labelledby="promise-heading" className="space-y-5">
        <h2 id="promise-heading" className="font-expressive text-3xl">
          The promise
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {PROMISES.map(({ icon: Icon, title, description }, index) => (
            <li
              key={title}
              className={cn(
                "relative grid content-between gap-8 overflow-hidden rounded-[1.75rem] p-6",
                PROMISE_TONES[index]!.tone,
              )}
            >
              <ExamShape
                kind={PROMISE_TONES[index]!.shape}
                colored={false}
                className="absolute -right-6 -bottom-8 size-32 opacity-15"
              />
              <span className="flex size-11 items-center justify-center rounded-full bg-current/10">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="relative space-y-1">
                <h3 className="font-expressive text-xl">{title}</h3>
                <p className="text-sm opacity-85">{description}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-5 rounded-[2rem] bg-surface p-7 text-center sm:p-10">
        <p className="font-expressive text-2xl text-pretty">
          If it helped you, the best thanks is sharing a paper you have, or just
          saying hi.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link to="/questions/contribute" className={buttonVariants()}>
            Share a paper
            <ArrowRight aria-hidden />
          </Link>
          {AUTHOR.links.map(({ network, label, href }) => (
            <a
              key={network}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              <SocialIcon network={network} />
              {label}
            </a>
          ))}
        </div>
      </section>
    </article>
  );
}
