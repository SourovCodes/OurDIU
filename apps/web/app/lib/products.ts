import {
  CalendarClock,
  FileText,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

/** The OurDIU products, as the hub and the header list them. */
export type Product = {
  name: string;
  description: string;
  icon: LucideIcon;
  /** A page on this site, or another site (the question bank, for now). */
  href: string;
  external?: boolean;
  status: "live" | "soon";
};

export const PRODUCTS: Product[] = [
  {
    name: "Class Routine",
    description:
      "Your section's week, a teacher's classes, and which rooms are free right now.",
    icon: CalendarClock,
    href: "/routine",
    status: "soon",
  },
  {
    name: "Question Bank",
    description:
      "Past exam question papers from every department, free to download.",
    icon: FileText,
    href: "https://diuqbank.com",
    external: true,
    status: "live",
  },
  {
    name: "Marketplace",
    description:
      "Buy and sell books, gadgets and more with other DIU students.",
    icon: ShoppingBag,
    href: "/market",
    status: "soon",
  },
];
