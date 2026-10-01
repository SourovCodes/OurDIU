import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { AndroidBetaBanner } from "~/components/android-beta";
import { SpaceIcon } from "~/components/space-icon";
import { PRODUCTS, type Product } from "~/lib/products";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/home";

export const meta: Route.MetaFunction = () => [
  { title: "OurDIU — Tools for DIU students" },
  {
    name: "description",
    content:
      "Class routines, past question papers and a student marketplace for Daffodil International University, in one place.",
  },
];

/** A product as a tile in its own colours, like the app's "What do you need?". */
function ProductTile({ product }: { product: Product }) {
  const soon = product.status === "soon";
  return (
    <Link
      to={product.href}
      className={cn(
        "group flex min-h-72 flex-col justify-between gap-8 rounded-[2rem] p-6 transition-[scale,opacity] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98] sm:p-8",
        product.tone.container,
        soon && "opacity-85 hover:opacity-100",
      )}
    >
      <div className="flex items-start justify-between">
        <SpaceIcon
          product={product}
          size={80}
          className="transition-transform duration-500 group-hover:rotate-12"
        />
        {soon ? (
          <span className="rounded-full bg-current/10 px-3 py-1 text-xs font-semibold">
            Coming soon
          </span>
        ) : (
          <span className="flex size-11 items-center justify-center rounded-full bg-current/10">
            <ArrowRight className="size-5" aria-hidden />
          </span>
        )}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold opacity-80">{product.name}</p>
        <h2 className="font-expressive text-3xl sm:text-4xl">
          {product.title}
        </h2>
        <p className="text-pretty opacity-85">{product.tagline}</p>
      </div>
    </Link>
  );
}

export default function Home() {
  return (
    <div className="space-y-10 py-2 sm:py-8">
      <div className="mx-auto max-w-2xl empty:hidden">
        <AndroidBetaBanner />
      </div>
      <section className="max-w-3xl space-y-5">
        <h1 className="font-display-xl text-6xl sm:text-8xl">
          What do you need today?
        </h1>
        <p className="max-w-xl text-lg text-pretty text-muted-foreground">
          Past question papers, your class routine and a student marketplace for
          DIU, with one account, on the web and in the OurDIU app.
        </p>
      </section>

      <section aria-label="Products" className="grid gap-3 md:grid-cols-3">
        {PRODUCTS.map((product) => (
          <ProductTile key={product.id} product={product} />
        ))}
      </section>
    </div>
  );
}
