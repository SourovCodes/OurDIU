import type { Product } from "~/lib/products";
import { useRoutinePlaces } from "./routine-nav";

export type NavItem = {
  to: string;
  label: string;
  /** Other paths that count as this item's section, e.g. course pages for Browse. */
  section?: string[];
  /** A count to show next to it, e.g. papers that need the user. */
  count?: number;
  /** Whether the page is in its section, when the path alone can't tell. */
  active?: boolean;
};

/** Each product's own menu; platform pages (hub, account, legal) have none. */
const NAV_ITEMS: Record<Product["id"], NavItem[]> = {
  questions: [
    {
      to: "/questions/departments",
      label: "Browse",
      section: ["/questions/courses/"],
    },
    { to: "/questions/browse", label: "All papers" },
    { to: "/questions/contributors", label: "Contributors" },
  ],
  // Today, Sections and Teachers depend on the department: `useNavItems`.
  routine: [],
  // One page: the maker itself.
  cover: [],
  market: [],
};

/** The space's menu: the Class Routine's places follow the department. */
export function useNavItems(product: Product | null): NavItem[] {
  const places = useRoutinePlaces();
  if (!product) return [];
  return product.id === "routine" ? [...places] : NAV_ITEMS[product.id];
}

export function inSection(item: NavItem, pathname: string) {
  if (item.active !== undefined) return item.active;
  return (
    pathname === item.to ||
    pathname.startsWith(`${item.to}/`) ||
    (item.section ?? []).some((prefix) => pathname.startsWith(prefix))
  );
}

/** "3", as a small pill next to a menu entry. */
export function CountPill({ count }: { count: number }) {
  return (
    <span className="ml-auto rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
      {count}
    </span>
  );
}

export const attentionLabel = (count: number) =>
  `${count} ${count === 1 ? "paper needs" : "papers need"} you`;
