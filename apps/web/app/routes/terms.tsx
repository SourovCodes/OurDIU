import { Link } from "react-router";
import { LegalPage, LegalSection } from "~/components/legal-page";
import { AUTHOR } from "~/lib/author";
import type { Route } from "./+types/terms";

export const meta: Route.MetaFunction = () => [
  { title: "Terms of use — OurDIU" },
  {
    name: "description",
    content: "The rules for using OurDIU and uploading question papers to it.",
  },
];

export default function Terms() {
  return (
    <LegalPage
      title="Terms of use"
      description="The rules for using OurDIU and sharing papers on it. By using the site, you agree to them."
    >
      <LegalSection id="service" title="The service">
        <p>
          OurDIU is a free set of tools for DIU students, including a collection
          of past question papers, run by {AUTHOR.name} as an independent
          project. It is not an official service of Daffodil International
          University. Anyone can browse and download published papers without an
          account.
        </p>
      </LegalSection>

      <LegalSection id="accounts" title="Your account">
        <ul>
          <li>
            You sign in with Google. New accounts need a DIU email address.
          </li>
          <li>
            Keep your Google account secure: what happens under your account is
            your responsibility.
          </li>
          <li>Accounts that break these terms can be limited or removed.</li>
        </ul>
      </LegalSection>

      <LegalSection id="uploads" title="Uploading papers">
        <p>When you upload a paper, you confirm that:</p>
        <ul>
          <li>
            it is a real question paper, and you are allowed to share it (for
            example, you received it in an exam);
          </li>
          <li>
            it doesn’t show anyone’s personal details, such as a student’s name,
            ID or signature, or answers written on it;
          </li>
          <li>
            the details you pick (department, course, semester, exam type) are
            correct as far as you know.
          </li>
        </ul>
        <p>
          Uploads are checked automatically and by an admin before they are
          published, and can be rejected, corrected or removed at any time.
        </p>
      </LegalSection>

      <LegalSection id="license" title="What you allow when you upload">
        <p>
          You keep whatever rights you have in what you upload. You give OurDIU
          free, non-exclusive, worldwide permission to store, compress,
          watermark, display and let people download it on the site, and to
          credit you by name. This permission continues after the paper is
          published, so other students can keep using it; to have a published
          paper removed, see <Link to="/copyright">copyright and removal</Link>.
        </p>
      </LegalSection>

      <LegalSection id="acceptable-use" title="Using the site fairly">
        <p>Please don’t:</p>
        <ul>
          <li>upload anything harmful, offensive or unrelated to exams;</li>
          <li>
            copy papers in bulk to publish or sell elsewhere, or remove their
            watermark to pass them off as your own;
          </li>
          <li>
            use scripts to scrape the site, inflate views or votes, or file
            false reports;
          </li>
          <li>try to break into, overload or disrupt the site.</li>
        </ul>
      </LegalSection>

      <LegalSection id="copyright" title="Copyright">
        <p>
          Question papers belong to their authors and the university. They are
          shared here free of charge, for study. If you hold rights in a paper
          and want it removed, see{" "}
          <Link to="/copyright">copyright and removal</Link>.
        </p>
      </LegalSection>

      <LegalSection id="no-warranty" title="No guarantees">
        <p>
          The site is provided as it is, for free. Papers may be incomplete,
          mislabelled or out of date, and the site may be unavailable at times.
          Always check with your department what an exam will actually cover. As
          far as the law allows, I am not liable for any loss from using the
          site or relying on its papers.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes to these terms">
        <p>
          These terms may change as the site does. The date at the top of the
          page shows when they last changed, and using the site after that means
          you accept the new version.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
