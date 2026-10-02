import { Mail } from "lucide-react";
import { Link, NavLink } from "react-router";
import { PageHeader, NARROW_PAGE } from "~/components/page-header";
import { AUTHOR } from "~/lib/author";
import { LEGAL_PAGES, LEGAL_UPDATED } from "~/lib/legal";
import { cn } from "~/lib/utils";

// Readable long-form text without the typography plugin: paragraphs, lists, links
// and tables inside a legal page's sections.
const PROSE =
  "space-y-10 leading-7 text-pretty [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-primary [&_code]:rounded [&_code]:bg-surface [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6";

type LegalPageProps = {
  title: string;
  /** One sentence summing up the page, under the title. */
  description: string;
  children: React.ReactNode;
};

/**
 * The shell of /privacy, /terms, /copyright and /cookies: title, last update, tabs
 * between the legal pages, the sections, and where to send questions.
 */
export function LegalPage({ title, description, children }: LegalPageProps) {
  return (
    <div className={cn(NARROW_PAGE, "space-y-8")}>
      <PageHeader title={title} description={description}>
        <p className="pt-1 text-xs text-muted-foreground">
          Last updated {LEGAL_UPDATED}
        </p>
      </PageHeader>

      <nav
        aria-label="Legal pages"
        className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
      >
        {LEGAL_PAGES.map(({ path, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn(
                "flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "border-primary-container bg-primary-container font-semibold text-primary-container-foreground"
                  : "border-input hover:state-layer",
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <article className={PROSE}>{children}</article>

      <aside className="flex flex-col gap-3 rounded-3xl bg-surface p-6 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-pretty">
          Questions about this page? Email{" "}
          <a
            href={`mailto:${AUTHOR.email}`}
            className="font-medium break-all underline underline-offset-4 hover:text-primary"
          >
            {AUTHOR.email}
          </a>
          .
        </p>
        <Link
          to="/contact"
          className="inline-flex shrink-0 items-center gap-1.5 font-medium underline-offset-4 hover:underline"
        >
          <Mail className="size-4" aria-hidden />
          Contact page
        </Link>
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
      <h2 id={id} className="font-expressive text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}
