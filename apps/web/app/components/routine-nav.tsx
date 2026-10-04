import { CalendarClock, GraduationCap, UsersRound } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { Link, useLocation, useMatches } from "react-router";
import {
  rememberDepartment,
  rememberedDepartment,
  routineDepartmentAt,
  routinePlaces,
} from "~/lib/routine";
import { cn } from "~/lib/utils";

// The Class Routine's three places (docs/PLAN.md, decision 34): Today, Students
// and Teachers, in the header on wide screens and a bottom bar on phones.

// The cookie only changes in the effect below, after a navigation.
const subscribe = () => () => {};

/**
 * Today, Students and Teachers, with Students and Teachers in the department the
 * page is in, else the one last looked at (CSE before any).
 */
export function useRoutinePlaces() {
  const { pathname } = useLocation();
  // Until a routine is live the space is "coming soon", with nowhere to go: the
  // routine's pages say so with `anyLive: false`.
  const comingSoon = useMatches().some(
    (m) =>
      (m.loaderData as { anyLive?: boolean } | undefined)?.anyLive === false,
  );
  const here = routineDepartmentAt(pathname);
  const remembered = useSyncExternalStore(
    subscribe,
    () => rememberedDepartment(document.cookie),
    () => null,
  );
  useEffect(() => {
    if (here) rememberDepartment(here);
  }, [here]);
  return comingSoon ? [] : routinePlaces(pathname, here ?? remembered ?? "cse");
}

const ICONS = {
  today: CalendarClock,
  sections: GraduationCap,
  teachers: UsersRound,
} as const;

/** On phones, the routine's places as a Material navigation bar at the bottom. */
export function RoutineBottomBar() {
  const places = useRoutinePlaces();
  if (!places.length) return null;
  return (
    <>
      {/* Room for the bar under the page's end. */}
      <div aria-hidden className="h-20 lg:hidden" />
      <nav
        aria-label="Class Routine"
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-surface-low/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto grid h-20 max-w-md grid-cols-3">
          {places.map((place) => {
            const Icon = ICONS[place.id];
            return (
              <li key={place.id}>
                <Link
                  to={place.to}
                  aria-current={place.active ? "page" : undefined}
                  className="group flex h-full flex-col items-center justify-center gap-1 text-xs font-medium"
                >
                  <span
                    className={cn(
                      "flex h-8 w-16 items-center justify-center rounded-full transition-colors group-hover:state-layer",
                      place.active &&
                        "bg-primary-container text-primary-container-foreground",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className={cn(place.active && "font-bold")}>
                    {place.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
