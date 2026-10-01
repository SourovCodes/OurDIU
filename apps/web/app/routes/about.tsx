import { ArrowRight, Gift, MegaphoneOff, Wrench } from "lucide-react";
import { Link } from "react-router";
import { ContributorAvatar } from "~/components/contributor-avatar";
import { SocialIcon } from "~/components/social-icons";
import { buttonVariants } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { AUTHOR } from "~/lib/author";
import type { Route } from "./+types/about";

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

export default function About() {
  return (
    <article className="mx-auto max-w-2xl space-y-10 py-4 sm:py-8">
      <header className="flex items-center gap-4">
        <ContributorAvatar
          name={AUTHOR.name}
          image={AUTHOR.avatar}
          size="xl"
          className="ring-2 ring-border ring-offset-2 ring-offset-background"
        />
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            Hi, I’m {AUTHOR.firstName} 👋
          </h1>
          <p className="text-muted-foreground">
            I built OurDIU, and I keep it running.
          </p>
        </div>
      </header>

      <div className="space-y-4 leading-7 text-pretty">
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

      <section aria-labelledby="promise-heading" className="space-y-4">
        <h2
          id="promise-heading"
          className="text-xl font-semibold tracking-tight"
        >
          The promise
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {PROMISES.map(({ icon: Icon, title, description }) => (
            <li key={title} className="grid">
              <Card className="bg-gradient-to-t from-primary/5 to-card py-5 shadow-xs">
                <CardContent className="space-y-2 px-5">
                  <div className="flex size-9 items-center justify-center rounded-lg border bg-background shadow-xs">
                    <Icon className="size-4" aria-hidden />
                  </div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4 rounded-xl border bg-muted/40 p-6 text-center">
        <p className="text-pretty">
          If it helped you, the best thanks is adding a paper you have, or just
          saying hi.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            to="/questions/contribute"
            className={buttonVariants({ size: "sm" })}
          >
            Contribute a paper
            <ArrowRight aria-hidden />
          </Link>
          {AUTHOR.links.map(({ network, label, href }) => (
            <a
              key={network}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
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
