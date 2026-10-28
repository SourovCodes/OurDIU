import { ROOM_VOICE_LIMIT } from "@ourdiu/shared/rooms";
import { Headphones, MessageSquare } from "lucide-react";
import { Link, useLocation } from "react-router";
import { Button, buttonVariants } from "~/components/ui/button";
import type { RoomSnapshot } from "~/lib/rooms/connection";
import { pausedUntil, roomLine } from "~/lib/rooms/labels";
import { useRoom, useRoomAccess, useRoomSummary } from "~/lib/rooms/use-room";
import { cn } from "~/lib/utils";
import { Facepile } from "./facepile";
import { useRooms } from "./rooms-provider";

const LiveDot = () => (
  <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />
);

/**
 * The course page's way into its room (docs/PLAN.md, decision 66): who's in the
 * call and here, with Join voice and Chat. Opening a course page connects you,
 * but you're only a number in "here" until you talk or write.
 */
export function CourseRoomCard({
  courseId,
  courseName,
}: {
  courseId: number;
  courseName: string;
}) {
  const { user, canJoin } = useRoomAccess();
  const { conn, snapshot } = useRoom(courseId, courseName);
  const summary = useRoomSummary(courseId, !canJoin);
  const rooms = useRooms();
  const { pathname } = useLocation();

  if (!canJoin) {
    const here = summary?.here ?? 0;
    return (
      <Shell tone={user ? "quiet" : "primary"}>
        <div className="min-w-0 flex-1 space-y-0.5">
          <Title live={here > 0}>
            {here > 0 ? `${here} in the course room` : "Course room"}
          </Title>
          <p className="text-sm opacity-85">
            {user
              ? "Course rooms are for DIU email accounts, so everyone in them is a student here."
              : "Sign in with your DIU email to talk with classmates on this course."}
          </p>
        </div>
        {!user && (
          <Link
            to={`/login?redirectTo=${encodeURIComponent(pathname)}`}
            className={buttonVariants()}
          >
            Sign in
          </Link>
        )}
      </Shell>
    );
  }

  const open = () => rooms?.openPanel(courseId);
  const join = () => {
    open();
    void conn?.voice.join();
  };
  const body = describe(snapshot);
  return (
    <Shell tone={body.tone ?? "primary"}>
      {snapshot?.state && (
        <Facepile
          voice={snapshot.state.voice}
          speaking={snapshot.voice.speaking}
        />
      )}
      <div className="min-w-0 flex-1 space-y-0.5">
        <Title live={body.live}>{body.title}</Title>
        <p className="text-sm opacity-85">{body.line}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {body.join && (
          <Button
            onClick={join}
            disabled={snapshot?.voice.phase === "starting"}
          >
            <Headphones aria-hidden />
            {body.join}
          </Button>
        )}
        {body.chat && (
          <Button
            variant="outline"
            onClick={open}
            className="border-transparent bg-background text-foreground hover:state-layer"
          >
            <MessageSquare aria-hidden />
            {body.chat}
          </Button>
        )}
      </div>
    </Shell>
  );
}

function describe(snapshot: RoomSnapshot | null): {
  title: string;
  line: string;
  live?: boolean;
  join?: string;
  chat?: string;
  tone?: "primary" | "quiet" | "warning";
} {
  if (snapshot?.closed) {
    return {
      title: "Course room",
      line: snapshot.closed.message,
      tone: "quiet",
    };
  }
  const state = snapshot?.state;
  if (!snapshot || !state) {
    return { title: "Course room", line: "Connecting…", tone: "quiet" };
  }
  const { voice, here, paused } = state;
  if (paused.voice && paused.chat) {
    return {
      title: "Course room",
      line: "Course rooms are paused for now.",
      tone: "quiet",
    };
  }
  if (snapshot.voice.phase === "in") {
    return {
      title: "You're in the course room",
      line: roomLine(state, snapshot.voice.speaking, snapshot.me?.id),
      live: true,
      chat: "Open room",
    };
  }
  if (paused.voice) {
    return {
      title: pausedUntil(state),
      line: "This month's free allowance for calls is used up. Chat still works.",
      chat: "Chat",
      tone: "warning",
    };
  }
  if (!state.voiceAvailable) {
    return {
      title: "Course room",
      line: "Voice calls aren't set up yet. Chat with classmates here meanwhile.",
      chat: "Chat",
    };
  }
  if (voice.length >= ROOM_VOICE_LIMIT) {
    return {
      title: `Voice is full (${voice.length}/${ROOM_VOICE_LIMIT})`,
      line: "You can still chat.",
      live: true,
      chat: "Open chat",
    };
  }
  if (voice.length === 0) {
    return {
      title: "Course room",
      line:
        here > 1
          ? `${here - 1} other${here > 2 ? "s" : ""} on this course now. Start a study call: anyone on this course can join.`
          : "Nobody's here yet. Start a study call: anyone on this course can join.",
      join: "Start a call",
      chat: "Chat",
    };
  }
  return {
    title: "Course room is live",
    line: `${roomLine(state, snapshot.voice.speaking)}. You'll join muted.`,
    live: true,
    join: "Join voice",
    chat: "Chat",
  };
}

function Shell({
  tone,
  children,
}: {
  tone: "primary" | "quiet" | "warning";
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label="Course room"
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-3 rounded-3xl p-4 sm:p-5",
        tone === "primary" &&
          "bg-primary-container text-primary-container-foreground",
        tone === "quiet" && "bg-surface",
        tone === "warning" && "bg-exam-quiz text-exam-quiz-foreground",
      )}
    >
      {children}
    </section>
  );
}

function Title({
  live,
  children,
}: {
  live?: boolean;
  children: React.ReactNode;
}) {
  return (
    // Not a heading: the page's headings are its semesters.
    <p className="flex items-center gap-2 font-semibold">
      {live && <LiveDot />}
      {children}
    </p>
  );
}
