import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { AndroidBetaBanner } from "~/components/android-beta";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { PRODUCTS, type Product } from "~/lib/products";
import type { Route } from "./+types/home";

export const meta: Route.MetaFunction = () => [
  { title: "OurDIU — Tools for DIU students" },
  {
    name: "description",
    content:
      "Class routines, past question papers and a student marketplace for Daffodil International University, in one place.",
  },
];

function ProductCard({ product }: { product: Product }) {
  const { icon: Icon, name, description, href, status } = product;
  const content = (
    <Card className="h-full gap-4 transition-colors group-hover:border-primary/40 group-hover:bg-muted/40">
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden />
          </span>
          {status === "soon" ? (
            <Badge variant="secondary">Coming soon</Badge>
          ) : (
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
          )}
        </div>
        <CardTitle className="text-lg">{name}</CardTitle>
        <CardDescription className="text-pretty">{description}</CardDescription>
      </CardHeader>
    </Card>
  );
  return (
    <Link
      to={href}
      className="group rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {content}
    </Link>
  );
}

export default function Home() {
  return (
    <div className="space-y-12 py-4 sm:py-10">
      <div className="mx-auto max-w-2xl empty:hidden">
        <AndroidBetaBanner />
      </div>
      <section className="mx-auto max-w-2xl space-y-4 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          What do you need today?
        </h1>
        <p className="text-lg text-pretty text-muted-foreground">
          Past question papers, your class routine and a student marketplace for
          DIU, with one account, on the web and in the OurDIU app.
        </p>
      </section>

      <section aria-label="Products" className="grid gap-4 md:grid-cols-3">
        {PRODUCTS.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </section>
    </div>
  );
}
