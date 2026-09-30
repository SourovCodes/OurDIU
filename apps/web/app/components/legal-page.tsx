import { NavLink } from "react-router";
import { PageHeader } from "~/components/page-header";
import { CONTACT_EMAIL, LEGAL_PAGES, LEGAL_UPDATED } from "~/lib/legal";
import { cn } from "~/lib/utils";

// Readable long-form text without the typography plugin: paragraphs, lists, links
// and tables inside a legal page's sections.
const PROSE =
  "space-y-10 leading-7 text-pretty [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-primary [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6";

type LegalPageProps = {
  title: string;
  /** One sentence summing up the page, under the title. */
  description: string;
  children: React.ReactNode;
};

/**
 * The shell of /privacy and /terms: title, last update, tabs
 * between the legal pages, the sections, and where to send questions.
 */
export function LegalPage({ title, description, children }: LegalPageProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title={title} description={description}>
        <p className="pt-1 text-xs text-muted-foreground">
          Last updated {LEGAL_UPDATED}
        </p>
      </PageHeader>

      <nav
        aria-label="Legal pages"
        // The divider is a shadow rather than a border, so the active tab's
        // underline can cover it without the scrolling row growing a scrollbar.
        className="flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-border)]"
      >
        {LEGAL_PAGES.map(({ path, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn(
                "border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
                isActive
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <article className={PROSE}>{children}</article>

      <aside className="rounded-xl border bg-muted/40 p-5 text-sm">
        <p className="text-pretty">
          Questions about this page? Email{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-medium break-all underline underline-offset-4"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </aside>
    </div>
  );
}

type LegalSectionProps = {
  /** The heading's anchor, so other pages can link to the section. */
  id: string;
  title: string;
  children: React.ReactNode;
};

/** A section of a legal page, with a heading other pages can link to. */
export function LegalSection({ id, title, children }: LegalSectionProps) {
  return (
    <section aria-labelledby={id} className="scroll-mt-20 space-y-3">
      <h2 id={id} className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}
