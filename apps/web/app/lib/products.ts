import {
  CalendarClock,
  FileText,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import { loginReturnPath } from "~/lib/redirect";

/**
 * The OurDIU products. Each is a space of its own under its path (docs/PLAN.md):
 * its own header and menu, and none shows another's data.
 */
export type Product = {
  id: "questions" | "routine" | "market";
  name: string;
  /** What it is, in the app's words, e.g. "Question papers". */
  title: string;
  /** One line, for the hub and the switcher. */
  tagline: string;
  description: string;
  icon: LucideIcon;
  /** The space's home; every page under it belongs to the product. */
  href: string;
  status: "live" | "soon";
  /** Its shape (one of the exam shapes) and colours, as in the app's spaces. */
  shape: "final" | "midterm" | "quiz";
  tone: {
    /** The space's container colour with its text colour. */
    container: string;
    /** The shape behind the icon. */
    accent: string;
    /** The icon on the shape. */
    onAccent: string;
  };
};

export const PRODUCTS: Product[] = [
  {
    id: "questions",
    name: "Question Bank",
    title: "Question papers",
    tagline: "Past quiz, midterm and final papers",
    description:
      "Past exam question papers from every department, free to read and download.",
    icon: FileText,
    href: "/questions",
    status: "live",
    shape: "final",
    tone: {
      container:
        "bg-[#e3dfff] text-[#1a0a73] dark:bg-[#3a27c7] dark:text-[#e3dfff]",
      accent: "text-[#4f39f6] dark:text-[#c5bfff]",
      onAccent: "text-white dark:text-[#3a27c7]",
    },
  },
  {
    id: "routine",
    name: "Class Routine",
    title: "My class routine",
    tagline: "Today’s classes, your week, free rooms",
    description:
      "Your section's week, a teacher's classes, and which rooms are free right now.",
    icon: CalendarClock,
    href: "/routine",
    status: "soon",
    shape: "midterm",
    tone: {
      container:
        "bg-[#b9f0e3] text-[#00382f] dark:bg-[#005145] dark:text-[#b9f0e3]",
      accent: "text-[#006b5b] dark:text-[#80d5c4]",
      onAccent: "text-white dark:text-[#005145]",
    },
  },
  {
    id: "market",
    name: "Marketplace",
    title: "Marketplace",
    tagline: "Buy and sell with DIU students",
    description:
      "Buy and sell books, gadgets and more with other DIU students.",
    icon: ShoppingBag,
    href: "/market",
    status: "soon",
    shape: "quiz",
    tone: {
      container:
        "bg-[#ffd9e3] text-[#5c1530] dark:bg-[#6e2440] dark:text-[#ffd9e3]",
      accent: "text-[#8e3a5a] dark:text-[#ffb0c8]",
      onAccent: "text-white dark:text-[#6e2440]",
    },
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

/**
 * The space a page shows in: its product, except that the login page keeps the
 * space of the page it returns to, so logging in from the Question Bank doesn't
 * leave it.
 */
export function spaceAt({
  pathname,
  search,
}: {
  pathname: string;
  search: string;
}): Product | null {
  if (pathname === "/login") {
    return productAt(loginReturnPath(search).split(/[?#]/)[0]!);
  }
  return productAt(pathname);
}
