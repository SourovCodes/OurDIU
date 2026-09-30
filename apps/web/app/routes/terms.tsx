import { LegalPage, LegalSection } from "~/components/legal-page";
import type { Route } from "./+types/terms";

export const meta: Route.MetaFunction = () => [
  { title: "Terms of use — OurDIU" },
  { name: "description", content: "The rules for using OurDIU." },
];

export default function Terms() {
  return (
    <LegalPage
      title="Terms of use"
      description="The rules for using OurDIU. By using the site or the app, you agree to them."
    >
      <LegalSection id="service" title="The service">
        <p>
          OurDIU is a free, independent set of tools for Daffodil International
          University students. It is not run by the university. Information such
          as class routines comes from what the university publishes; always
          check official notices when it matters.
        </p>
        <p>
          The service is provided as is, without guarantees that it is complete,
          correct or always available.
        </p>
      </LegalSection>

      <LegalSection id="accounts" title="Your account">
        <p>
          You sign in with Google. New accounts need a DIU email address. Keep
          your Google account secure: whatever is done while signed in counts as
          yours. Accounts that abuse the service may be suspended.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes">
        <p>
          These terms may change as new products launch. The date at the top
          shows when they last did.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
