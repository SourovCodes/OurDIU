import { Mail } from "lucide-react";
import { Link } from "react-router";
import { LegalPage, LegalSection } from "~/components/legal-page";
import { Button } from "~/components/ui/button";
import { AUTHOR } from "~/lib/author";
import { mailto } from "~/lib/legal";
import type { Route } from "./+types/delete-account";

export const meta: Route.MetaFunction = () => [
  { title: "Delete your account — OurDIU" },
  {
    name: "description",
    content:
      "How to delete your OurDIU account, on the site or in the OurDIU app for Android, and what happens to your data.",
  },
];

// Google Play's account deletion link points here; the app's Account screen
// starts the same email (lib/features/account/account_screen.dart).
const REQUEST = mailto(
  AUTHOR.email,
  "Delete my account",
  "Please delete my OurDIU account. I'm writing from the email address I sign in with.",
);

export default function DeleteAccount() {
  return (
    <LegalPage
      title="Delete your account"
      description="How to delete your OurDIU account, from the site or the OurDIU app for Android, and what happens to your data."
    >
      <LegalSection id="how" title="How to ask">
        <p>
          Email{" "}
          <a href={REQUEST} className="break-all">
            {AUTHOR.email}
          </a>{" "}
          from the address you sign in with, so I know the account is yours. In
          the OurDIU app, <strong>Account → Delete account</strong> starts the
          same email.
        </p>
        <Button
          asChild
          className="no-underline! hover:text-primary-foreground!"
        >
          <a href={REQUEST}>
            <Mail aria-hidden />
            Email a deletion request
          </a>
        </Button>
        <p>
          I delete the account within 30 days and reply when it’s done. Signing
          in again afterwards starts a new, empty account.
        </p>
      </LegalSection>
      <LegalSection id="deleted" title="What is deleted">
        <ul>
          <li>
            Your account and profile: name, email address, photo and username.
          </li>
          <li>Your sign-in sessions, on the site and in the app.</li>
          <li>Your likes, dislikes and reports.</li>
          <li>Uploads that aren’t published yet.</li>
        </ul>
      </LegalSection>
      <LegalSection id="kept" title="What stays">
        <p>
          Papers you published stay in the bank so other students can keep using
          them, no longer linked to you. Ask in the same email, and their public
          copies are re-made without your name. See the{" "}
          <Link to="/privacy#retention">privacy policy</Link> for how long
          everything else is kept.
        </p>
      </LegalSection>
      <LegalSection id="app-data" title="Data on your phone">
        <p>
          Saved papers, recent courses and your theme live only in the app on
          your phone. Signing out removes your session from it, and uninstalling
          the app removes everything else.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
