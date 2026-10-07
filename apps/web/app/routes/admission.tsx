import { ArrowRight, ExternalLink, Mail, Phone } from "lucide-react";
import { Link } from "react-router";
import { PROSE } from "~/components/legal-page";
import { NARROW_PAGE } from "~/components/page-header";
import { buttonVariants } from "~/components/ui/button";
import {
  ADMISSION_CHECKED,
  ADMISSION_CHECKED_ISO,
  ADMISSION_EMAIL,
  ADMISSION_FAQ,
  ADMISSION_PATH,
  ADMISSION_PHONE,
  ADMISSION_PORTAL,
  ADMISSION_SOURCES,
  APPLY_STEPS,
  DOCUMENTS,
  ELIGIBILITY,
  SEMESTERS,
  TEST_SLOTS,
} from "~/lib/admission";
import { AUTHOR } from "~/lib/author";
import { originOf, pageMeta, QB_NAME } from "~/lib/seo";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/admission";

/**
 * A guide to DIU's admission and its test for students who want to get in, who
 * search for "DIU admission test questions" (docs/PLAN.md, decision 23). Static: the
 * facts are in `lib/admission.ts`, from DIU's own pages.
 */
export const meta: Route.MetaFunction = ({ matches }) => {
  const origin = originOf(matches);
  const title =
    "DIU Admission Test Guide: Eligibility, Test Schedule and Documents";
  const description =
    "How to get into Daffodil International University (DIU): who can apply, how to apply online, the admission test and its times by faculty, the documents to bring, waivers and the admission office's contacts.";
  return [
    ...pageMeta({ title, description }),
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        name: title,
        description,
        url: origin + ADMISSION_PATH,
        dateModified: ADMISSION_CHECKED_ISO,
        mainEntity: ADMISSION_FAQ.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    },
  ];
};

export default function Admission() {
  return (
    <article className={cn(NARROW_PAGE, "space-y-10 py-2 sm:py-6")}>
      <header className="space-y-5 rounded-[2rem] bg-primary-container p-7 text-primary-container-foreground sm:p-10">
        <p className="text-sm font-semibold tracking-wide uppercase opacity-80">
          Admission guide
        </p>
        <h1 className="font-expressive text-4xl text-balance sm:text-5xl">
          Getting into DIU: the admission test and how to apply
        </h1>
        <p className="text-lg leading-8 text-pretty">
          Everything a new student needs for Daffodil International University’s
          admission, from who can apply to the day of the test, in one place.
          Taken from DIU’s own admission pages, last checked on{" "}
          {ADMISSION_CHECKED}.
        </p>
        <a
          href={ADMISSION_PORTAL}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ size: "lg" })}
        >
          Apply online
          <ExternalLink aria-hidden />
        </a>
      </header>

      <div className={PROSE}>
        <section className="space-y-4">
          <h2 className="font-expressive text-3xl">How to apply</h2>
          <ol className="list-none! space-y-3! pl-0!">
            {APPLY_STEPS.map((step, i) => (
              <li
                key={step.title}
                className="flex gap-4 rounded-3xl bg-surface p-5 pl-5!"
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div className="min-w-0 space-y-1 break-words">
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="text-muted-foreground">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="font-expressive text-3xl">Who can apply</h2>
          <ul>
            {ELIGIBILITY.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>
            Each program’s exact requirements are on DIU’s program pages, or ask
            the admission office.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-expressive text-3xl">The admission test</h2>
          <p>
            Admission tests are held by faculty, for each semester. The test
            takes one hour; each faculty has its own time on the test day:
          </p>
          <div className="overflow-hidden rounded-2xl bg-surface-low">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-high">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Faculty of
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Test time
                  </th>
                </tr>
              </thead>
              <tbody>
                {TEST_SLOTS.map((slot) => (
                  <tr key={slot.faculty} className="border-t border-surface">
                    <td className="px-4 py-3">{slot.faculty}</td>
                    <td className="px-4 py-3 sm:whitespace-nowrap">
                      {slot.time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            The test dates for the coming semester are on the{" "}
            <a href={ADMISSION_PORTAL} target="_blank" rel="noreferrer">
              admission portal
            </a>
            . You can sit the tests of up to three faculties if their times
            don’t clash.
          </p>
          <h3 className="text-lg font-semibold">What to prepare</h3>
          <p>
            DIU doesn’t publish a syllabus or past papers for the admission test
            that we could find. Revise your HSC basics, English, and for science
            and engineering programs Mathematics and Physics. Come early with
            your admit card.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-expressive text-3xl">When to apply</h2>
          <p>
            DIU takes new students three times a year. Each semester has its own
            application deadline:
          </p>
          <ul>
            {SEMESTERS.map((semester) => (
              <li key={semester.name}>
                <strong>{semester.name}</strong>: {semester.months}
              </li>
            ))}
          </ul>
          <p>
            A few programs, such as LL.B., Pharmacy and Architecture, run two
            semesters a year and take students for Spring and Fall.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-expressive text-3xl">Documents to bring</h2>
          <ul>
            {DOCUMENTS.map((document) => (
              <li key={document}>{document}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="font-expressive text-3xl">Fees and waivers</h2>
          <p>
            Tuition differs by program: see DIU’s{" "}
            <a
              href="https://daffodilvarsity.edu.bd/tuition-fees"
              target="_blank"
              rel="noreferrer"
            >
              tuition fees
            </a>
            . Waivers on tuition depend on your SSC and HSC results (DIU’s{" "}
            <a
              href="https://daffodilvarsity.edu.bd/tuition-fee-calculator"
              target="_blank"
              rel="noreferrer"
            >
              waiver calculator
            </a>{" "}
            shows yours), and there are{" "}
            <a
              href="https://daffodilvarsity.edu.bd/scholarship"
              target="_blank"
              rel="noreferrer"
            >
              scholarships and waivers
            </a>{" "}
            for other reasons too. For CSE, LL.B. and B.Pharm, only a GPA 5.00
            in HSC and quota-based waivers count. Ask for waivers you qualify
            for when you’re admitted; need-based ones are applied for after your
            first semester.
          </p>
        </section>

        <section className="space-y-6">
          <h2 className="font-expressive text-3xl">Questions</h2>
          {ADMISSION_FAQ.map(({ question, answer }) => (
            <div key={question} className="space-y-1.5">
              <h3 className="text-lg font-semibold">{question}</h3>
              <p>{answer}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="font-expressive text-3xl">Admission office</h2>
          <ul className="list-none! space-y-2! pl-0!">
            <li className="flex items-center gap-3 pl-0!">
              <Phone className="size-4 shrink-0" aria-hidden />
              <a href={`tel:${ADMISSION_PHONE}`}>{ADMISSION_PHONE}</a>
              <span className="text-muted-foreground">
                8 am to 6 pm, working days
              </span>
            </li>
            <li className="flex items-center gap-3 pl-0!">
              <Mail className="size-4 shrink-0" aria-hidden />
              <a href={`mailto:${ADMISSION_EMAIL}`}>{ADMISSION_EMAIL}</a>
            </li>
          </ul>
          <p className="text-sm text-muted-foreground">
            OurDIU is run by a student, not by the university. Dates, fees and
            rules change from semester to semester, so check DIU’s pages before
            you decide anything:
          </p>
          <ul className="text-sm">
            {ADMISSION_SOURCES.map((source) => (
              <li key={source.href}>
                <a href={source.href} target="_blank" rel="noreferrer">
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="space-y-4 rounded-[2rem] bg-surface p-7 text-center sm:p-10">
        <p className="font-expressive text-2xl text-pretty">
          Once you’re in, every exam has past papers here.
        </p>
        <p className="text-pretty text-muted-foreground">
          The {QB_NAME} has DIU’s midterm and final question papers, shared by
          students. Have an admission test question paper?{" "}
          <Link to="/contact" className="underline underline-offset-4">
            Send it to {AUTHOR.name}
          </Link>{" "}
          and it will be added for the next applicants.
        </p>
        <Link to="/questions" className={buttonVariants()}>
          Open the {QB_NAME}
          <ArrowRight aria-hidden />
        </Link>
      </section>
    </article>
  );
}
