import { ComingSoon } from "~/components/coming-soon";
import { product as findProduct } from "~/lib/products";
import type { Route } from "./+types/routine";

const product = findProduct("routine");

export const meta: Route.MetaFunction = () => [
  { title: "Class routine — OurDIU" },
  { name: "description", content: product.description },
];

export default function Routine() {
  return <ComingSoon product={product} />;
}
