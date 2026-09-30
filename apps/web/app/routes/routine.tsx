import { ComingSoon } from "~/components/coming-soon";
import { PRODUCTS } from "~/lib/products";
import type { Route } from "./+types/routine";

const product = PRODUCTS.find((p) => p.name === "Class Routine")!;

export const meta: Route.MetaFunction = () => [
  { title: "Class routine — OurDIU" },
  { name: "description", content: product.description },
];

export default function Routine() {
  return <ComingSoon product={product} />;
}
