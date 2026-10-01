import {
  CalendarClock,
  FileText,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

/**
 * The OurDIU products. Each is a space of its own under its path (docs/PLAN.md):
 * its own header and menu, and none shows another's data.
 */
export type Product = {
  id: "questions" | "routine" | "market";
  name: string;
  /** One line, for the hub and the switcher. */
  tagline: string;
  description: string;
  icon: LucideIcon;
  /** The space's home; every page under it belongs to the product. */
  href: string;
  status: "live" | "soon";
};

export const PRODUCTS: Product[] = [
  {
    id: "questions",
    name: "Question Bank",
    tagline: "Past exam papers",
    description:
      "Past exam question papers from every department, free to read and download.",
    icon: FileText,
    href: "/questions",
    status: "live",
  },
  {
    id: "routine",
    name: "Class Routine",
    tagline: "Your classes and week",
    description:
      "Your section's week, a teacher's classes, and which rooms are free right now.",
    icon: CalendarClock,
    href: "/routine",
    status: "soon",
  },
  {
    id: "market",
    name: "Marketplace",
    tagline: "Buy and sell on campus",
    description:
      "Buy and sell books, gadgets and more with other DIU students.",
    icon: ShoppingBag,
    href: "/market",
    status: "soon",
  },
];

export function product(id: Product["id"]): Product {
  return PRODUCTS.find((p) => p.id === id)!;
}

/** The product whose space a path is in, or null for platform pages (hub, account, legal). */
export function productAt(pathname: string): Product | null {
  return (
    PRODUCTS.find(
      (p) => pathname === p.href || pathname.startsWith(`${p.href}/`),
    ) ?? null
  );
}
