import {
  Bug,
  Copy,
  FileX,
  Lightbulb,
  Mail,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";
import { toast } from "~/lib/toast";
import { LINK_CARD, STRETCHED_LINK } from "~/components/question-cards";
import { SocialIcon } from "~/components/social-icons";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { AUTHOR } from "~/lib/author";
import { mailto } from "~/lib/legal";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/contact";
import { NARROW_PAGE } from "~/components/page-header";

export const meta: Route.MetaFunction = () => [
  { title: "Contact — OurDIU" },
  {
    name: "description",
    content:
      "Report a bug, suggest an idea, or ask for a paper to be removed from the OurDIU Question Bank.",
  },
];

type Topic = {
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  subject: string;
  /** Prefilled email body: the questions that make a message easy to act on. */
  body?: string;
};

const TOPICS: Topic[] = [
  {
    icon: Bug,
    title: "Report a bug",
    description: "Something broken, slow or confusing on the site.",
    subject: "Bug report",
    body: "Page link:\n\nWhat happened:\n\nWhat you expected:\n\nPhone or computer, and browser:\n",
  },
  {
    icon: Lightbulb,
    title: "Suggest an idea",
    description: "A feature, a missing course, or anything that would help.",
    subject: "Idea",
  },
  {
    icon: FileX,
    title: "Remove a paper",
    description: (
      <>
        Copyright or personal details. See{" "}
        <Link
          to="/copyright"
          className="relative z-10 font-medium text-foreground underline underline-offset-4 hover:text-primary"
        >
          how removal works
        </Link>
        .
      </>
    ),
    subject: "Removal request",
    body: "Link to the paper(s):\n\nWhy it should be removed:\n",
  },
  {
    icon: UserRound,
    title: "Your account or data",
    description: (
      <>
        A copy, a correction or deletion. See the{" "}
        <Link
          to="/privacy#your-rights"
          className="relative z-10 font-medium text-foreground underline underline-offset-4 hover:text-primary"
        >
          privacy policy
        </Link>
        .
      </>
    ),
    subject: "Account and data request",
  },
];

async function copyEmail() {
  try {
    await navigator.clipboard.writeText(AUTHOR.email);
    toast.success("Email address copied");
  } catch {
    toast.error("Couldn’t copy. Select the address and copy it instead.");
  }
}

export default function Contact() {
  return (
    <div className={cn(NARROW_PAGE, "space-y-8")}>
      <div className="space-y-3">
        <h1 className="font-display-xl text-5xl sm:text-7xl">Contact</h1>
        <p className="text-lg text-muted-foreground">
          Found a bug, have an idea, or need a paper removed? Email me.
        </p>
      </div>

      <Card className="bg-primary-container text-primary-container-foreground">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground max-sm:hidden">
              <Mail className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm opacity-80">Email</p>
              <a
                href={`mailto:${AUTHOR.email}`}
                className="font-expressive text-lg break-all underline-offset-4 hover:underline"
              >
                {AUTHOR.email}
              </a>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyEmail}
              className="border-current/30 text-current"
            >
              <Copy aria-hidden />
              Copy
            </Button>
            <a
              href={`mailto:${AUTHOR.email}`}
              className={buttonVariants({ size: "sm" })}
            >
              Send an email
            </a>
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="topics-heading" className="space-y-4">
        <div className="space-y-1">
          <h2 id="topics-heading" className="font-expressive text-2xl">
            What’s it about?
          </h2>
          <p className="text-sm text-muted-foreground">
            Pick one to start an email with the right subject and a few
            questions to answer.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {TOPICS.map(({ icon: Icon, title, description, subject, body }) => (
            <li key={title} className="grid">
              <Card className={cn(LINK_CARD, "py-5")}>
                <CardContent className="space-y-2 px-5">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-primary-container text-primary-container-foreground">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <h3 className="font-semibold">
                    <a
                      href={mailto(AUTHOR.email, subject, body)}
                      className={STRETCHED_LINK}
                    >
                      {title}
                    </a>
                  </h3>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-3xl bg-surface p-6 text-sm">
        <p className="text-pretty">
          I run OurDIU in my spare time, so a reply can take a few days. Wrong
          details on a paper? Signed-in students can also use the{" "}
          <strong>Report</strong> button on it.
        </p>
        <div className="flex flex-wrap gap-2">
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
    </div>
  );
}
