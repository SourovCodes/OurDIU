import { Link } from "react-router";
import { LegalPage, LegalSection } from "~/components/legal-page";
import { AUTHOR } from "~/lib/author";
import { mailto } from "~/lib/legal";
import type { Route } from "./+types/privacy";

export const meta: Route.MetaFunction = () => [
  { title: "Privacy policy — OurDIU" },
  {
    name: "description",
    content:
      "What OurDIU collects, what is public, who processes it, and how to get your data changed or deleted.",
  },
];

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy policy"
      description="What OurDIU collects, what other people can see, and what you can change or delete."
    >
      <LegalSection id="who" title="Who runs OurDIU">
        <p>
          OurDIU (ourdiu.com, which includes the question bank formerly at
          diuqbank.com) is a free set of tools for DIU students run by{" "}
          {AUTHOR.name}, an individual, not a company. It is an independent
          project, not an official service of Daffodil International University.
          In this policy, “I” and “me” mean {AUTHOR.firstName}, and “you” means
          anyone who visits the site.
        </p>
        <p>The site has no ads and never sells or rents your data to anyone.</p>
      </LegalSection>

      <LegalSection id="collected" title="What is collected">
        <p>
          <strong>When you browse</strong>, without signing in, nothing is
          linked to you by name. Google Analytics records which pages are
          visited, from what kind of device and roughly where (country or city),
          so I can see what’s useful. Cloudflare, which hosts the site, handles
          your IP address and browser details to deliver pages and block
          attacks.
        </p>
        <p>
          <strong>When you sign in with Google</strong>, the site receives your
          name, email address, profile photo and Google account ID. Your photo
          is copied to the site’s own storage. Each sign-in keeps a session with
          the IP address and browser it came from, and the tokens Google issues
          for signing in. You also get a username, which you can change.
        </p>
        <p>
          <strong>When you upload a paper</strong> (this needs a DIU email
          address), the site stores the PDF, the details you chose (department,
          course, semester, exam type and the optional section or batch) and
          when you uploaded it. While it’s reviewed, the site also keeps the
          messages you and the site’s admins write about it, and each step of
          the review: when it was published, sent back for changes or rejected,
          and when you edited it, replaced its file or resubmitted it.
        </p>
        <p>
          <strong>When you like, dislike or report a paper</strong>, the site
          stores your choice, and for reports the reason and any note you wrote.
        </p>
        <p>
          <strong>When you save a paper</strong>, the site stores which papers
          you saved and when, so your Saved list is the same on the website and
          in the app. Only you can see it, and removing a paper from it deletes
          that record.
        </p>
        <p>
          <strong>View counts</strong> aren’t tied to you: a cookie in your
          browser only remembers which pages it already counted today (see the{" "}
          <Link to="/cookies">cookie notice</Link>).
        </p>
      </LegalSection>

      <LegalSection id="mobile-app" title="In the mobile app">
        <p>
          The OurDIU app for Android collects the same account, upload and like,
          dislike or report data as the site, when you do the same things.
          Unlike the site, it doesn’t use Google Analytics or cookies.
        </p>
        <ul>
          <li>
            <strong>Signing in</strong> keeps a session token in your phone’s
            secure storage, so you stay signed in. Signing out removes it.
          </li>
          <li>
            <strong>Recent courses and your theme</strong> are kept on your
            phone only, and are removed when you uninstall the app.{" "}
            <strong>Saved papers</strong> are kept on your phone too, and once
            you sign in they are saved to your account, the same list as on the
            website.
          </li>
          <li>
            <strong>Scanning a paper</strong> uses the camera through Google’s
            document scanner, which runs on your phone. Only the PDF you choose
            to upload leaves it. The same goes for PDFs you pick from your files
            or share to the app from another one.
          </li>
        </ul>
      </LegalSection>
      <LegalSection id="use" title="How it is used">
        <ul>
          <li>To sign you in and show your account and uploads.</li>
          <li>
            To review uploads: check that a PDF is a question paper, read its
            details, compress it and publish it.
          </li>
          <li>
            To read the text of a paper, so a published paper’s questions can be
            read on its page and found by search.
          </li>
          <li>
            To credit contributors, rank papers by likes and views, and hide
            papers that several people report.
          </li>
          <li>To keep the site working, find bugs and stop abuse.</li>
        </ul>
      </LegalSection>

      <LegalSection id="public" title="What other people can see">
        <ul>
          <li>
            Your <strong>name, photo and username</strong>, on your contributor
            profile and next to papers you published, with how many papers you
            shared and how often they were viewed.
          </li>
          <li>
            Your <strong>published papers</strong>. Their downloadable copies
            carry a watermark with your name and the site’s address, and the
            text read off them is shown on their page and searchable.
          </li>
        </ul>
        <p>
          Your email address, papers that are pending or rejected, review
          messages, and who liked, disliked or reported a paper are never shown
          publicly. The site’s admins can see them to review uploads and
          reports.
        </p>
      </LegalSection>

      <LegalSection id="teachers" title="Teachers in the class routine">
        <p>
          The Class Routine shows the routines DIU’s departments publish, with
          each class’s teacher by their initials. Next to them it shows a
          teacher’s{" "}
          <strong>
            name, the room where they sit, work email and phone number
          </strong>{" "}
          where the department’s routine lists them or the site’s admins add
          them from what the university publishes. Each teacher also has a page
          with their week as the routine has it (the classes they teach, when,
          where and to which sections), found by initials or name. A teacher who
          wants a detail changed or removed can write to us (see the contact
          page) and we’ll do it.
        </p>
      </LegalSection>

      <LegalSection id="processors" title="Services that process your data">
        <ul>
          <li>
            <strong>Cloudflare</strong> hosts the site, its database and its
            file storage, including uploaded PDFs and profile photos.
          </li>
          <li>
            <strong>Google</strong> handles sign-in, runs Google Analytics, and
            its Gemini AI reads uploaded PDFs to check them, suggest their
            details and read their text.
          </li>
          <li>
            <strong>A PDF processing service I run</strong> compresses uploads
            and adds the watermark to published papers.
          </li>
        </ul>
        <p>
          These services may process data outside Bangladesh. Each works under
          its own privacy terms.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="How long it is kept">
        <ul>
          <li>
            Your account and profile, until it is deleted. A sign-in session
            ends after 7 days without use, or when you log out.
          </li>
          <li>
            Uploads that aren’t published yet, until you withdraw them or they
            are reviewed. Published papers stay in the bank so other students
            can keep using them.
          </li>
          <li>
            A paper’s review messages, as long as the paper: withdrawing or
            deleting it deletes them too.
          </li>
          <li>
            If your account is deleted, your likes, dislikes, reports and saved
            papers are deleted with it. Papers you published, and the review
            messages you wrote on them, stay, no longer linked to you; ask, and
            their public copies are re-made without your name.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="your-rights" title="What you can do">
        <ul>
          <li>
            Change your name, photo and username on{" "}
            <Link to="/account">your account</Link>.
          </li>
          <li>
            Withdraw uploads that aren’t published yet from{" "}
            <Link to="/questions/my-submissions">your submissions</Link>.
          </li>
          <li>
            Ask for a copy of your data, a correction, or your account to be
            deleted (<Link to="/delete-account">how deleting works</Link>), by
            emailing{" "}
            <a href={mailto(AUTHOR.email, "Account and data request")}>
              {AUTHOR.email}
            </a>{" "}
            from the address you sign in with.
          </li>
          <li>
            Block or delete cookies in your browser, and turn off Google
            Analytics with Google’s{" "}
            <a
              href="https://tools.google.com/dlpage/gaoptout"
              target="_blank"
              rel="noopener noreferrer"
            >
              opt-out add-on
            </a>
            . The site works without analytics cookies.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="changes" title="Changes to this policy">
        <p>
          If this policy changes, the date at the top of the page changes with
          it.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
