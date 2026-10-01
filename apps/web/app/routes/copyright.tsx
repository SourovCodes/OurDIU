import { Link } from "react-router";
import { LegalPage, LegalSection } from "~/components/legal-page";
import { AUTHOR } from "~/lib/author";
import { mailto } from "~/lib/legal";
import type { Route } from "./+types/copyright";

export const meta: Route.MetaFunction = () => [
  { title: "Copyright and removal — OurDIU" },
  {
    name: "description",
    content:
      "How to ask for a question paper to be removed from the OurDIU Question Bank, and what happens next.",
  },
];

const REMOVAL_TEMPLATE = `Link to the paper(s):

Why it should be removed (copyright, personal details, other):

Your name, and your connection to the paper:

I confirm that this request is accurate and made in good faith.
`;

export default function Copyright() {
  const removal = mailto(AUTHOR.email, "Removal request", REMOVAL_TEMPLATE);
  return (
    <LegalPage
      title="Copyright and removal"
      description="Papers here are shared by students, for study. If one shouldn’t be here, this is how to get it removed."
    >
      <LegalSection id="papers" title="Where the papers come from">
        <p>
          Students upload the papers they received in their exams. Every upload
          is checked before it is published. Copyright stays with the paper’s
          authors and the university: OurDIU only shares the papers, free, with
          no ads and no profit.
        </p>
      </LegalSection>

      <LegalSection id="request" title="Asking for a paper to be removed">
        <p>
          Email <a href={removal}>{AUTHOR.email}</a> if you hold rights in a
          paper and don’t want it shared, or if a paper shows someone’s personal
          details (a name, student ID, signature or written answers). Please
          include:
        </p>
        <ol>
          <li>the link to each paper (the address of its page);</li>
          <li>why it should be removed;</li>
          <li>your name, and your connection to the paper;</li>
          <li>that your request is accurate and made in good faith.</li>
        </ol>
        <p>The link above opens an email with these points ready to fill in.</p>
      </LegalSection>

      <LegalSection id="next" title="What happens next">
        <ul>
          <li>I review each request as soon as I can and reply by email.</li>
          <li>
            A paper with a clear problem is hidden while I check it, then
            removed from the site and its downloads.
          </li>
          <li>
            If the uploader believes it was removed by mistake, they can email
            me with their reasons.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="other-problems" title="Wrong details or a bad file">
        <p>
          If a paper is filed under the wrong course or semester, is unreadable,
          is a duplicate or is the wrong file, signed-in students can use the{" "}
          <strong>Report</strong> button on the paper instead. Admins review
          reports, and a paper several people report is hidden automatically.
          You can also <Link to="/contact">get in touch</Link> directly.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
