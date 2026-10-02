import { Link } from "react-router";
import { LegalPage, LegalSection } from "~/components/legal-page";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { GA_MEASUREMENT_ID } from "~/lib/analytics";
import type { Route } from "./+types/cookies";

export const meta: Route.MetaFunction = () => [
  { title: "Cookie notice — OurDIU" },
  {
    name: "description",
    content: "Every cookie OurDIU sets, what it's for and how long it lasts.",
  },
];

type CookieRow = {
  names: string[];
  purpose: string;
  lasts: string;
};

// Keep in step with the code that sets them: Better Auth (apps/api/src/lib/auth.ts),
// lib/theme.ts, lib/department-preference.ts, lib/android-app.ts, lib/products.ts, the API's lib/view-cookie.ts and
// lib/analytics.ts.
const NEEDED: CookieRow[] = [
  {
    names: ["better-auth.session_token"],
    purpose:
      "Keeps you signed in. Only set when you sign in. On the live site its name starts with __Secure-.",
    lasts: "7 days, renewed while you use the site",
  },
  {
    names: ["better-auth.state"],
    purpose:
      "Protects signing in with Google from forged requests. Also starts with __Secure- on the live site.",
    lasts: "5 minutes, while you sign in",
  },
];

const PREFERENCES: CookieRow[] = [
  {
    names: ["ourdiu_theme"],
    purpose: "Remembers light or dark mode, if you pick one.",
    lasts: "1 year",
  },
  {
    names: ["qb_department"],
    purpose:
      "Remembers the department you last filtered questions by, so the list opens on it.",
    lasts: "1 year",
  },
  {
    names: ["ourdiu_space"],
    purpose:
      "Remembers which part of OurDIU you were last in (e.g. the Question Bank), so pages like your account keep its menu and lead back to it.",
    lasts: "1 year",
  },
  {
    names: ["ourdiu_android_invite"],
    purpose:
      "Set if you close the invitation to test the Android app, so it stays closed.",
    lasts: "400 days",
  },
  {
    names: ["qb_views_q", "qb_views_s"],
    purpose:
      "Count your view of a question or paper once a day. They only hold page numbers and times.",
    lasts: "24 hours",
  },
];

const ANALYTICS: CookieRow[] = [
  {
    names: ["_ga", `_ga_${GA_MEASUREMENT_ID.replace(/^G-/, "")}`],
    purpose:
      "Google Analytics: tell visits apart, so I can see how many people use the site and which pages help.",
    lasts: "Up to 2 years",
  },
];

function CookieNames({ names }: { names: string[] }) {
  return (
    <div className="flex flex-col items-start gap-1">
      {names.map((name) => (
        <code key={name} className="break-all whitespace-normal">
          {name}
        </code>
      ))}
    </div>
  );
}

/** A table from `sm` up; on phones, where three columns get cramped, one card per cookie. */
function CookieTable({ label, rows }: { label: string; rows: CookieRow[] }) {
  return (
    <>
      <div className="overflow-hidden rounded-2xl bg-surface-low max-sm:hidden">
        <Table aria-label={label}>
          <TableHeader className="bg-surface-high">
            <TableRow>
              <TableHead className="w-1/3">Cookie</TableHead>
              <TableHead>What it’s for</TableHead>
              <TableHead className="w-1/5">Lasts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.names[0]}>
                <TableCell className="align-top">
                  <CookieNames names={row.names} />
                </TableCell>
                <TableCell className="align-top whitespace-normal">
                  {row.purpose}
                </TableCell>
                <TableCell className="align-top whitespace-normal">
                  {row.lasts}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul aria-label={label} className="!list-none space-y-3 !pl-0 sm:hidden">
        {rows.map((row) => (
          <li
            key={row.names[0]}
            className="space-y-2 rounded-2xl bg-surface-low p-4 !pl-4 text-sm"
          >
            <CookieNames names={row.names} />
            <p>{row.purpose}</p>
            <p className="text-muted-foreground">Lasts: {row.lasts}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function Cookies() {
  return (
    <LegalPage
      title="Cookie notice"
      description="Every cookie OurDIU sets, what it’s for and how long it lasts. None are used for ads."
    >
      <LegalSection id="needed" title="Needed to sign in">
        <p>Without these you can still browse and download, but not sign in.</p>
        <CookieTable label="Sign-in cookies" rows={NEEDED} />
      </LegalSection>

      <LegalSection id="preferences" title="Preferences and view counts">
        <p>
          These are set by OurDIU itself and never leave it. Deleting them
          resets your choices.
        </p>
        <CookieTable label="Preference cookies" rows={PREFERENCES} />
        <p>
          Your browser’s own storage (not a cookie) also keeps the courses you
          opened recently, for the course search’s Recent list. It never leaves
          your browser.
        </p>
      </LegalSection>

      <LegalSection id="analytics" title="Analytics">
        <p>
          Set by Google Analytics, which reports usage to Google. They are not
          used for ads. To stop them, block cookies for the site or use Google’s{" "}
          <a
            href="https://tools.google.com/dlpage/gaoptout"
            target="_blank"
            rel="noopener noreferrer"
          >
            opt-out add-on
          </a>
          .
        </p>
        <CookieTable label="Analytics cookies" rows={ANALYTICS} />
      </LegalSection>

      <LegalSection id="control" title="Controlling cookies">
        <p>
          Your browser can show, block and delete cookies. Blocking the sign-in
          cookies stops you from signing in; the rest of the site keeps working.
          See the <Link to="/privacy">privacy policy</Link> for how your data is
          used.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
