import { MessageSquare, Mic, MicOff, PhoneOff } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { Link, useLocation } from "react-router";
import { courseHref } from "~/components/course-search";
import { Button } from "~/components/ui/button";
import type { RoomConnection } from "~/lib/rooms/connection";
import { roomLine } from "~/lib/rooms/labels";
import { productAt } from "~/lib/products";
import { cn } from "~/lib/utils";

/** The bar's height and margin, reserved below the page (app.css). */
const RESERVED = "5rem";

/**
 * Your call, while you're away from its course's pages (docs/PLAN.md, decision 66):
 * mute, chat, back to the room and hang up, from any page.
 */
export default function CallBar({
  room,
  onOpen,
}: {
  room: RoomConnection;
  onOpen: () => void;
}) {
  const snapshot = useSyncExternalStore(
    room.subscribe,
    room.getSnapshot,
    room.getSnapshot,
  );
  const { pathname } = useLocation();
  // Above the routine's own bar on phones.
  const overRoutineBar = productAt(pathname)?.id === "routine";

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--call-bar-height", RESERVED);
    return () => {
      root.style.removeProperty("--call-bar-height");
    };
  }, []);

  const { state, me, voice, unread } = snapshot;
  const mine = state?.voice.find((v) => v.id === me?.id);
  return (
    <div
      role="region"
      aria-label="Your call"
      className={cn(
        "fixed inset-x-2 bottom-2 z-40 flex items-center gap-2 rounded-3xl bg-primary-container-foreground py-2 pr-2 pl-4 text-primary-container shadow-xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[26rem] dark:bg-primary-container dark:text-primary-container-foreground",
        overRoutineBar &&
          "max-lg:bottom-[calc(5.5rem+env(safe-area-inset-bottom))]",
      )}
    >
      <span
        className="size-2.5 shrink-0 animate-pulse rounded-full bg-[#8fe3cf]"
        aria-hidden
      />
      <Link
        to={courseHref(snapshot.courseId)}
        onClick={onOpen}
        className="min-w-0 flex-1 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="block truncate text-sm font-semibold">
          {snapshot.courseName}
        </span>
        <span className="block truncate text-xs opacity-80">
          {state ? roomLine(state, voice.speaking, me?.id) : "Connecting…"}
        </span>
      </Link>
      <Button
        size="icon-lg"
        variant="ghost"
        className="size-11 bg-white/10 hover:state-layer"
        onClick={() => room.voice.toggleMute()}
        disabled={!mine?.live}
        aria-label={mine?.muted === false ? "Mute" : "Unmute"}
        aria-pressed={mine?.muted === false}
      >
        {mine?.muted === false ? <Mic aria-hidden /> : <MicOff aria-hidden />}
      </Button>
      <Button
        size="icon-lg"
        variant="ghost"
        className="relative size-11 bg-white/10 hover:state-layer"
        onClick={onOpen}
        aria-label={unread ? `Chat, ${unread} new` : "Chat"}
      >
        <MessageSquare aria-hidden />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ffb4ab] px-1 text-[10px] font-bold text-[#690005]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>
      <Button
        size="icon-lg"
        className="size-11 bg-[#ffb4ab] text-[#690005] hover:bg-[#ffb4ab]/90"
        onClick={() => room.voice.leave()}
        aria-label="Leave the call"
      >
        <PhoneOff aria-hidden />
      </Button>
    </div>
  );
}
