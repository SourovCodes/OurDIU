import { ArrowRight, MoveRight } from "lucide-react";
import { Link } from "react-router";
import { PROSE } from "~/components/legal-page";
import { NARROW_PAGE } from "~/components/page-header";
import { buttonVariants } from "~/components/ui/button";
import { AUTHOR } from "~/lib/author";
import { formatNumber } from "~/lib/format";
import {
  ADDRESS_CHANGES,
  MOVE_DATE,
  MOVE_DATE_ISO,
  MOVE_FAQ,
  MOVE_PATH,
} from "~/lib/move";
import { originOf, pageMeta, QB_NAME, SITE_NAME } from "~/lib/seo";
import { loadTaxonomy } from "~/lib/taxonomy.server";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/diuqbank";

/**
 * What became of diuqbank.com, for the students who knew it and for search
 * engines and AI answers that still name it (docs/PLAN.md, decision 19).
 */
export const meta: Route.MetaFunction = ({ matches }) => {
  const origin = originOf(matches);
  const title = `DIU QBank (diuqbank.com) is now the ${QB_NAME} on ${SITE_NAME}`;
  const description = `On ${MOVE_DATE}, diuqbank.com moved to ourdiu.com/questions. The same free DIU past question papers, accounts and contributors; old links redirect. What changed and why.`;
  return [
    ...pageMeta({ title, description }),
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        name: title,
        description,
        url: origin + MOVE_PATH,
        datePublished: MOVE_DATE_ISO,
        dateModified: MOVE_DATE_ISO,
        author: {
          "@type": "Person",
          name: AUTHOR.name,
          url: `${origin}/about`,
        },
        mainEntity: MOVE_FAQ.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    },
  ];
};

export async function loader({ request }: Route.LoaderArgs) {
  const { departments, courses } = await loadTaxonomy(request);
  return {
    papers: departments.reduce((sum, d) => sum + d.publishedCount, 0),
    departments: departments.filter((d) => d.publishedCount > 0).length,
    courses: courses.filter((c) => c.publishedCount > 0).length,
  };
}

export default function Diuqbank({ loaderData }: Route.ComponentProps) {
  const { papers, departments, courses } = loaderData;
  return (
    <article className={cn(NARROW_PAGE, "space-y-10 py-2 sm:py-6")}>
      <header className="space-y-5 rounded-[2rem] bg-primary-container p-7 text-primary-container-foreground sm:p-10">
        <p className="text-sm font-semibold tracking-wide uppercase opacity-80">
          Moved on {MOVE_DATE}
        </p>
        <h1 className="font-expressive text-4xl text-balance sm:text-5xl">
          DIU QBank is now the {QB_NAME} on {SITE_NAME}
        </h1>
        <p className="text-lg leading-8 text-pretty">
          diuqbank.com, the free bank of past exam question papers for Daffodil
          International University, moved to{" "}
          <strong>ourdiu.com/questions</strong>
          {papers > 0 && (
            <>
              {" "}
              with all of its {formatNumber(papers)} papers from{" "}
              {formatNumber(courses)} courses in {departments} departments
            </>
          )}
          . Old links redirect on their own, and your account came along.
        </p>
        <Link to="/questions" className={buttonVariants({ size: "lg" })}>
          Open the {QB_NAME}
          <ArrowRight aria-hidden />
        </Link>
      </header>

      <div className={PROSE}>
        <section className="space-y-4">
          <h2 className="font-expressive text-3xl">Where things are now</h2>
          <ul className="list-none! space-y-2! pl-0!">
            {ADDRESS_CHANGES.map(({ from, to }) => (
              <li
                key={from}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-surface px-5 py-3 pl-5!"
              >
                <span className="text-muted-foreground line-through decoration-1">
                  {from}
                </span>
                <MoveRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="font-semibold">{to}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="font-expressive text-3xl">Why the move</h2>
          <p>
            The question bank started in 2024 as a side project: one place for
            DIU past papers, so nobody has to dig through group chats the night
            before an exam. But students need more than papers, like their class
            routine and a place to buy and sell things, and those belong
            together with the papers rather than on yet another site.
          </p>
          <p>
            So the question bank became the first part of{" "}
            <Link to="/">OurDIU</Link>, one site and one app for DIU students.
            The <Link to="/routine">Class Routine</Link> and the{" "}
            <Link to="/market">Marketplace</Link> come next.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-expressive text-3xl">What stays the same</h2>
          <ul>
            <li>Free to read and download, no ads, no sign-up to read.</li>
            <li>
              Every paper, course and contributor, and the paper numbers:
              diuqbank.com/questions/123 is ourdiu.com/questions/123.
            </li>
            <li>Your Google sign-in, profile, shared and saved papers.</li>
            <li>
              The same person running it: <Link to="/about">{AUTHOR.name}</Link>
              .
            </li>
          </ul>
        </section>

        <section className="space-y-6">
          <h2 className="font-expressive text-3xl">Questions</h2>
          {MOVE_FAQ.map(({ question, answer }) => (
            <div key={question} className="space-y-1.5">
              <h3 className="text-lg font-semibold">{question}</h3>
              <p>{answer}</p>
            </div>
          ))}
        </section>
      </div>

      <section className="space-y-4 rounded-[2rem] bg-surface p-7 text-center sm:p-10">
        <p className="font-expressive text-2xl text-pretty">
          Looking for a paper? It’s where it always was, just at a new address.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link to="/questions" className={buttonVariants()}>
            Open the {QB_NAME}
            <ArrowRight aria-hidden />
          </Link>
          <Link
            to="/questions/departments"
            className={buttonVariants({ variant: "outline" })}
          >
            Browse departments
          </Link>
        </div>
      </section>
    </article>
  );
}
