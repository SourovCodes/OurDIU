import { ComingSoon } from "~/components/coming-soon";
import { PRODUCTS } from "~/lib/products";
import type { Route } from "./+types/market";

const product = PRODUCTS.find((p) => p.name === "Marketplace")!;

export const meta: Route.MetaFunction = () => [
  { title: "Marketplace — OurDIU" },
  { name: "description", content: product.description },
];

export default function Market() {
  return <ComingSoon product={product} />;
}
