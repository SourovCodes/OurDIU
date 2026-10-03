import { ArrowRight } from "lucide-react";
import { Link, redirect } from "react-router";
import { SpaceIcon } from "~/components/space-icon";
import { HUB_LIVE, PRODUCTS, type Product } from "~/lib/products";
import { plural } from "~/lib/submissions";
import { loadTaxonomy } from "~/lib/taxonomy.server";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/home";
import { pageMeta, originOf, websiteJsonLd } from "~/lib/seo";
import { AUTHOR } from "~/lib/author";

export const meta: Route.MetaFunction = ({ matches }) => [
  ...pageMeta({
    title: "OurDIU — DIU Question Bank and tools for DIU students",
    description:
      "Free tools for Daffodil International University (DIU) students: the DIU Question Bank of past exam papers, and soon class routines and a student marketplace.",
  }),
  websiteJsonLd(originOf(matches), AUTHOR),
];

/** A product as a tile in its own colours, like the app's "What do you need?". */
function ProductTile({
  product,
  stat,
}: {
  product: Product;
  /** What's in it so far, e.g. "1,634 papers · 12 departments". */
  stat?: string;
}) {
  const soon = product.status === "soon";
  return (
    <Link
      to={product.href}
      className={cn(
        "group flex rounded-[2rem] p-6 transition-[scale,opacity] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98] sm:p-8",
        product.tone.container,
        soon
          ? "items-center gap-5 opacity-90 hover:opacity-100"
          : "min-h-72 flex-col justify-between gap-8 md:row-span-2 md:min-h-[26rem]",
      )}
    >
      <div
        className={cn("flex items-start justify-between", soon && "shrink-0")}
      >
        <SpaceIcon
          product={product}
          size={soon ? 56 : 96}
          className="transition-transform duration-500 group-hover:rotate-12"
        />
        {!soon && (
          <span className="flex size-12 items-center justify-center rounded-full bg-current/10 transition-transform group-hover:translate-x-1">
            <ArrowRight className="size-5" aria-hidden />
          </span>
        )}
      </div>
      <div className={cn("min-w-0", soon ? "space-y-1" : "space-y-2")}>
        {soon ? (
          <p className="text-xs font-semibold tracking-wide uppercase opacity-90">
            Coming soon
          </p>
        ) : (
          product.name !== product.title && (
            <p className="text-sm font-semibold opacity-90">{product.name}</p>
          )
        )}
        <h2
          className={cn(
            "font-expressive",
            soon ? "text-2xl" : "text-4xl sm:text-5xl",
          )}
        >
          {product.title}
        </h2>
        <p className="text-pretty opacity-85">{product.tagline}</p>
        {stat && (
          <p className="pt-2 text-sm font-semibold tabular-nums">{stat}</p>
        )}
      </div>
    </Link>
  );
}

export async function loader({ request }: Route.LoaderArgs) {
  if (!HUB_LIVE) {
    // The visitor's query (e.g. utm_*) goes along; React Router's own `_routes`, on
    // the data request of a client-side navigation, doesn't.
    const query = new URL(request.url).searchParams;
    query.delete("_routes");
    const search = query.size > 0 ? `?${query}` : "";
    // Temporary, so it isn't cached: the hub returns with a second product.
    throw redirect(`/questions${search}`, 302);
  }
  const { departments } = await loadTaxonomy(request);
  const withPapers = departments.filter((d) => d.publishedCount > 0);
  return {
    questions: `${plural(
      withPapers.reduce((sum, d) => sum + d.publishedCount, 0),
      "paper",
    )} from ${plural(withPapers.length, "department")}`,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  // Live products first; the others are still to come.
  const products = [...PRODUCTS].sort(
    (a, b) => Number(a.status === "soon") - Number(b.status === "soon"),
  );
  return (
    <div className="space-y-8 py-2 sm:space-y-10 sm:py-8">
      <section className="max-w-3xl space-y-4 sm:space-y-5">
        <h1 className="font-display-xl text-5xl text-balance sm:text-8xl">
          What do you need today?
        </h1>
        <p className="max-w-xl text-pretty text-muted-foreground sm:text-lg">
          Past question papers, your class routine and a student marketplace for
          DIU, with one account, on the web and in the OurDIU app.
        </p>
      </section>

      <section aria-label="Products" className="grid gap-3 md:grid-cols-2">
        {products.map((product) => (
          <ProductTile
            key={product.id}
            product={product}
            stat={product.id === "questions" ? loaderData.questions : undefined}
          />
        ))}
      </section>
    </div>
  );
}
