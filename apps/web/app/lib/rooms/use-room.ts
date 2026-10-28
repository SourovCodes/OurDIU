import type { RoomSummary } from "@ourdiu/shared";
import { canContribute } from "@ourdiu/shared/constants";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouteLoaderData } from "react-router";
import { useRooms } from "~/components/rooms/rooms-provider";
import { whenIdle } from "~/lib/idle";
import { toast } from "~/lib/toast";
import type { RootLoader } from "~/root";
import { RoomConnection, type RoomSnapshot } from "./connection";

const noop = () => () => {};
const none = () => null;

/** Who may join rooms: DIU email accounts and admins (decision 66). */
export function useRoomAccess() {
  const user = useRouteLoaderData<RootLoader>("root")?.user ?? null;
  return {
    user,
    canJoin: !!user && canContribute(user),
  };
}

/**
 * The course's room, for a page that shows it: connected once the page is idle
 * (and kept while you move between the course's pages, or are in its call).
 * Null for people who can't join, and until connected.
 */
export function useRoom(courseId: number, courseName: string) {
  const rooms = useRooms();
  const { canJoin } = useRoomAccess();
  const [conn, setConn] = useState<RoomConnection | null>(null);

  useEffect(() => {
    if (!rooms || !canJoin) return;
    let acquired = false;
    const cancel = whenIdle(() => {
      acquired = true;
      setConn(
        rooms.acquire(
          courseId,
          () =>
            new RoomConnection(courseId, courseName, (message) =>
              toast(message),
            ),
        ),
      );
    });
    return () => {
      cancel();
      if (acquired) rooms.release(courseId);
      setConn(null);
    };
    // The name only labels a new connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, canJoin, courseId]);

  const snapshot = useSyncExternalStore<RoomSnapshot | null>(
    conn?.subscribe ?? noop,
    conn?.getSnapshot ?? none,
    none,
  );
  return { conn, snapshot };
}

/** Counts for people who can't join (signed out, not a DIU address). */
export function useRoomSummary(courseId: number, enabled: boolean) {
  const [summary, setSummary] = useState<RoomSummary | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const cancel = whenIdle(() => {
      fetch(`/api/v1/rooms/${courseId}`)
        .then((res) => (res.ok ? (res.json() as Promise<RoomSummary>) : null))
        .then((data) => live && setSummary(data))
        .catch(() => {});
    });
    return () => {
      live = false;
      cancel();
    };
  }, [courseId, enabled]);
  return summary;
}
