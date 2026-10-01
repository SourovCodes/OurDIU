import { ExamShape } from "~/components/exam-badge";
import type { Product } from "~/lib/products";
import { cn } from "~/lib/utils";

/** A product's icon on its shape, in its colours, as in the app's chooser. */
export function SpaceIcon({
  product,
  size = 64,
  className,
}: {
  product: Product;
  size?: number;
  className?: string;
}) {
  const Icon = product.icon;
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <ExamShape
        kind={product.shape}
        colored={false}
        className={cn("absolute inset-0 size-full", product.tone.accent)}
      />
      <Icon
        className={cn("relative", product.tone.onAccent)}
        style={{ width: size * 0.42, height: size * 0.42 }}
      />
    </span>
  );
}
