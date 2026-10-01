import { ComingSoon } from "~/components/coming-soon";
import { product as findProduct } from "~/lib/products";
import type { Route } from "./+types/market";

const product = findProduct("market");

export const meta: Route.MetaFunction = () => [
  { title: "Marketplace — OurDIU" },
  { name: "description", content: product.description },
];

export default function Market() {
  return <ComingSoon product={product} />;
}
