import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RoomConnection } from "~/lib/rooms/connection";

// The room code itself (sockets, WebRTC) loads with the course and paper pages that
// use it (lib/rooms/use-room.ts); the shell only keeps track of open rooms, so a
// call survives moving between pages (docs/PLAN.md, decision 66).
const CallBar = lazy(() => import("./call-bar"));
const RoomPanel = lazy(() => import("./room-panel"));

type Entry = { conn: RoomConnection; pages: number; closeTimer?: number };

type Rooms = {
  /** A page shows this course's room: connect (once) and keep it open. */
  acquire(courseId: number, create: () => RoomConnection): RoomConnection;
  release(courseId: number): void;
  /** The room whose panel is open, if any. */
  panel: number | null;
  openPanel(courseId: number): void;
  closePanel(): void;
};

const RoomsContext = createContext<Rooms | null>(null);

export function useRooms() {
  return useContext(RoomsContext);
}

/** Leaving a room's pages closes it after this, unless you're in its call. */
const CLOSE_AFTER_MS = 3000;

export function RoomsProvider({ children }: { children: React.ReactNode }) {
  const entries = useRef(new Map<number, Entry>());
  const [panel, setPanel] = useState<RoomConnection | null>(null);
  // The room you're in a call in, and whether a page shows it (no bar then).
  const [call, setCall] = useState<RoomConnection | null>(null);
  const [shown, setShown] = useState<ReadonlySet<number>>(new Set());

  const closeIfUnused = useCallback((courseId: number) => {
    const entry = entries.current.get(courseId);
    if (
      !entry ||
      entry.pages > 0 ||
      entry.conn.voice.snapshot.phase !== "idle"
    ) {
      return;
    }
    entry.conn.close();
    entries.current.delete(courseId);
    setPanel((open) => (open?.courseId === courseId ? null : open));
  }, []);

  const rooms = useMemo<Rooms>(
    () => ({
      acquire(courseId, create) {
        let entry = entries.current.get(courseId);
        if (!entry) {
          const conn = create();
          entry = { conn, pages: 0 };
          entries.current.set(courseId, entry);
          // Track the call: the bar shows it, and a room in a call stays open.
          let phase = conn.voice.snapshot.phase;
          conn.subscribe(() => {
            const next = conn.voice.snapshot.phase;
            if (next === phase) return;
            phase = next;
            if (next !== "idle") {
              // One call at a time: joining here leaves the other.
              for (const [id, other] of entries.current) {
                if (
                  other.conn !== conn &&
                  other.conn.voice.snapshot.phase !== "idle"
                ) {
                  other.conn.voice.leave();
                  closeIfUnused(id);
                }
              }
              setCall(conn);
            } else {
              setCall((current) => (current === conn ? null : current));
              closeIfUnused(courseId);
            }
          });
        }
        window.clearTimeout(entry.closeTimer);
        entry.pages += 1;
        setShown((s) => new Set(s).add(courseId));
        return entry.conn;
      },
      release(courseId) {
        const entry = entries.current.get(courseId);
        if (!entry) return;
        entry.pages -= 1;
        if (entry.pages > 0) return;
        setShown((s) => {
          const next = new Set(s);
          next.delete(courseId);
          return next;
        });
        entry.closeTimer = window.setTimeout(
          () => closeIfUnused(courseId),
          CLOSE_AFTER_MS,
        );
      },
      panel: panel?.courseId ?? null,
      openPanel: (courseId) =>
        setPanel(entries.current.get(courseId)?.conn ?? null),
      closePanel: () => setPanel(null),
    }),
    [panel, closeIfUnused],
  );

  // Leaving the site (or reloading) ends the call cleanly.
  useEffect(() => {
    const leave = () => {
      for (const { conn } of entries.current.values()) conn.close();
    };
    window.addEventListener("pagehide", leave);
    return () => window.removeEventListener("pagehide", leave);
  }, []);

  return (
    <RoomsContext.Provider value={rooms}>
      {children}
      <Suspense>
        {call && !shown.has(call.courseId) && panel !== call && (
          <CallBar room={call} onOpen={() => setPanel(call)} />
        )}
        {panel && <RoomPanel room={panel} onClose={() => setPanel(null)} />}
      </Suspense>
    </RoomsContext.Provider>
  );
}
