import { Link } from "react-router";
import { SpaceIcon } from "~/components/space-icon";
import { buttonVariants } from "~/components/ui/button";
import type { Product } from "~/lib/products";
import { cn } from "~/lib/utils";

/** The page of a product that isn't out yet, in its own colours. */
export function ComingSoon({ product }: { product: Product }) {
  return (
    <section
      className={cn(
        "flex min-h-[60svh] flex-col items-center justify-center gap-6 rounded-[2rem] px-6 py-16 text-center",
        product.tone.container,
      )}
    >
      <SpaceIcon product={product} size={120} />
      <h1 className="sr-only">{product.name}</h1>
      <p className="max-w-xl font-display-xl text-4xl text-balance sm:text-6xl">
        {product.name} is coming soon
      </p>
      <p className="max-w-md text-pretty opacity-85">
        {product.description} We’re building it now.
      </p>
      {/* The space's own colour: the body carries the space. */}
      <Link to="/" className={buttonVariants({ size: "lg" })}>
        Back to OurDIU
      </Link>
    </section>
  );
}
