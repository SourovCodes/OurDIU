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
  /** The Class Routine's is "soon" here; `useProducts` makes it live once a routine is. */
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

/**
 * Whether the hub at / ("What do you need?") is shown. Until a second product is
 * live it isn't: / redirects to the question bank (a 302, which browsers don't
 * cache, so the hub can come back), "All of OurDIU" links are hidden, the sitemap
 * leaves / out and the WebSite markup moves to /questions. On since the Class
 * Routine launched (5 October 2026).
 */
export const HUB_LIVE = true;

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
    tagline: "Today’s classes, your section’s or a teacher’s week",
    description:
      "Your section's week and today's classes, or a teacher's, from DIU's routines.",
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

/**
 * Product pages outside their product's path: /diuqbank tells the question bank's
 * story and /admission guides applicants, but they sit at the root because the app
 * opens /questions/* links.
 */
const PRODUCT_PAGES: Record<string, Product["id"]> = {
  "/diuqbank": "questions",
  "/admission": "questions",
};

/** The product whose space a path is in, or null for platform pages (hub, account, legal). */
export function productAt(pathname: string): Product | null {
  const own = PRODUCT_PAGES[pathname];
  return (
    PRODUCTS.find(
      (p) =>
        p.id === own ||
        pathname === p.href ||
        pathname.startsWith(`${p.href}/`),
    ) ?? null
  );
}

/**
 * Remembers the space the visitor was last in, so platform pages (account,
 * legal, about, the 404 page) keep its header and lead back to it. A cookie, so
 * the server renders the same header the browser will.
 */
export const SPACE_COOKIE = "ourdiu_space";

/** The space a Cookie header (or `document.cookie`) remembers, if any. */
export function rememberedSpace(
  cookie: string | null | undefined,
): Product | null {
  const id = cookie?.match(
    new RegExp(`(?:^|;\\s*)${SPACE_COOKIE}=(\\w+)`),
  )?.[1];
  return PRODUCTS.find((p) => p.id === id) ?? null;
}

/** Remembers a space in the browser for a year. */
export function rememberSpace(product: Product) {
  document.cookie = `${SPACE_COOKIE}=${product.id}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/** Pages of the platform itself, which take the remembered space. Not the hub. */
function isPlatformPage(pathname: string) {
  return (
    pathname !== "/" && !productAt(pathname) && !pathname.startsWith("/admin")
  );
}

/**
 * The space a page shows in: its product's; the login page takes the space of the
 * page it returns to; other platform pages (account, legal, about, a missing
 * page) the space the visitor was last in. The hub belongs to none.
 */
export function spaceAt(
  {
    pathname,
    search,
  }: {
    pathname: string;
    search: string;
  },
  last: Product | null = null,
): Product | null {
  if (pathname === "/login") {
    const back = loginReturnPath(search).split(/[?#]/)[0]!;
    return productAt(back) ?? (back === "/" ? null : last);
  }
  return productAt(pathname) ?? (isPlatformPage(pathname) ? last : null);
}

/** The products, the Class Routine live once a department's routine is. */
export const productsWith = (routineLive: boolean): Product[] =>
  PRODUCTS.map((p) =>
    p.id === "routine" && routineLive ? { ...p, status: "live" } : p,
  );
