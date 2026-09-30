import { Link } from "react-router";
import { EmptyState } from "~/components/empty-state";
import { buttonVariants } from "~/components/ui/button";
import type { Product } from "~/lib/products";

/** The page of a product that isn't out yet. */
export function ComingSoon({ product }: { product: Product }) {
  return (
    <EmptyState
      className="min-h-[60svh] border-none"
      icon={product.icon}
      title={`${product.name} is coming soon`}
      description={`${product.description} We're building it now.`}
      action={
        <Link
          to="/"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Back to OurDIU
        </Link>
      }
    />
  );
}
