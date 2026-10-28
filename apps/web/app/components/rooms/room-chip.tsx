import { Headphones } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useRoom } from "~/lib/rooms/use-room";
import { useRooms } from "./rooms-provider";

/**
 * A paper page's way into its course's room: the course page has the card, so
 * here it's one small button that opens the same panel (decision 36).
 */
export function RoomChip({
  courseId,
  courseName,
}: {
  courseId: number;
  courseName: string;
}) {
  const rooms = useRooms();
  const { snapshot } = useRoom(courseId, courseName);
  const state = snapshot?.state;
  if (!state || snapshot.closed) return null;
  const inVoice = state.voice.length;
  const label = inVoice
    ? `${courseName} room, ${inVoice} in voice`
    : `${courseName} room`;
  return (
    <Button
      variant="secondary"
      onClick={() => rooms?.openPanel(courseId)}
      aria-label={label}
      title={label}
    >
      {inVoice > 0 ? (
        <span className="size-2 rounded-full bg-primary" aria-hidden />
      ) : (
        <Headphones aria-hidden />
      )}
      <span className="max-sm:hidden">Room</span>
      {inVoice > 0 && <span className="tabular-nums">{inVoice}</span>}
    </Button>
  );
}
