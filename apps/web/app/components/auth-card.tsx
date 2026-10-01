import { Bookmark, ThumbsUp, Upload } from "lucide-react";
import { ExamBadge } from "~/components/exam-badge";

type AuthCardProps = {
  title: string;
  description: string;
  footer: React.ReactNode;
  children: React.ReactNode;
};

/** What an account is for, beside the sign-in, like the app's sign-in card. */
const PERKS = [
  {
    icon: Bookmark,
    text: "Save papers for exam week, on the website and in the app",
  },
  { icon: Upload, text: "Share papers and see how many students read them" },
  {
    icon: ThumbsUp,
    text: "Vote, so the clearest copy of each exam comes first",
  },
];

/** Log in: the exam shapes and what you get on one side, the sign-in on the other. */
export function AuthCard({
  title,
  description,
  footer,
  children,
}: AuthCardProps) {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-3 py-2 sm:py-8 md:grid-cols-2">
      <section
        aria-label="Why log in"
        className="relative flex min-h-96 flex-col justify-end gap-5 overflow-hidden rounded-[2rem] bg-primary-container p-7 text-primary-container-foreground max-md:order-last sm:p-9"
      >
        <div aria-hidden className="mb-auto flex items-end gap-2">
          <ExamBadge examType="Final" size={104} />
          <ExamBadge examType="Midterm" size={76} />
          <ExamBadge examType="Quiz" size={56} />
          <ExamBadge
            examType="Lab Final"
            size={64}
            className="rotate-[-8deg]"
          />
        </div>
        <h2 className="relative font-expressive text-3xl">
          One account for OurDIU
        </h2>
        <ul className="relative grid gap-3">
          {PERKS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="pt-1 text-pretty">{text}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col justify-center gap-6 rounded-[2rem] bg-surface p-7 sm:p-10">
        <div className="space-y-3">
          <h1 className="font-display-xl text-5xl">{title}</h1>
          <p className="text-pretty text-muted-foreground">{description}</p>
        </div>
        {children}
        <p className="text-sm text-pretty text-muted-foreground">{footer}</p>
      </section>
    </div>
  );
}
