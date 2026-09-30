import { LegalPage, LegalSection } from "~/components/legal-page";
import { CONTACT_EMAIL } from "~/lib/legal";
import type { Route } from "./+types/privacy";

export const meta: Route.MetaFunction = () => [
  { title: "Privacy policy — OurDIU" },
  {
    name: "description",
    content:
      "What OurDIU collects, what it's used for, and how to get your data changed or deleted.",
  },
];

// Keep this in step with what the site actually collects, and update LEGAL_UPDATED
// (lib/legal.ts) with every change.
export default function Privacy() {
  return (
    <LegalPage
      title="Privacy policy"
      description="What OurDIU collects, what it's used for, and what you can change or delete."
    >
      <LegalSection id="who" title="Who runs OurDIU">
        <p>
          OurDIU (ourdiu.com) is a free, independent project for students of
          Daffodil International University. It is not an official service of
          the university. It has no ads and never sells or rents your data.
        </p>
      </LegalSection>

      <LegalSection id="collected" title="What is collected">
        <p>
          <strong>When you browse</strong> without signing in, nothing is linked
          to you. Cloudflare, which hosts the site, handles your IP address and
          browser details to deliver pages and block attacks.
        </p>
        <p>
          <strong>When you sign in with Google</strong>, the site receives your
          name, email address, profile photo and Google account ID. One account
          works across every OurDIU product and the OurDIU app. Each sign-in
          keeps a session with the IP address and browser it came from.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="Cookies">
        <ul>
          <li>
            A session cookie keeps you signed in. It's only set when you log in.
          </li>
          <li>
            <code>ourdiu_theme</code> remembers whether you chose the light or
            dark theme.
          </li>
        </ul>
        <p>There are no advertising or tracking cookies.</p>
      </LegalSection>

      <LegalSection id="rights" title="Changing or deleting your data">
        <p>
          You can change your name and username in your account settings. To
          delete your account and everything linked to it, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the
          address you sign in with.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
