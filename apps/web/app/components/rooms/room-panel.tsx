import {
  ROOM_CHAT_MAX_LENGTH,
  ROOM_REPORT_REASON_LABELS,
  ROOM_REPORT_REASONS,
  ROOM_TALKER_LIMIT,
  ROOM_VOICE_LIMIT,
  type RoomPerson,
  type RoomReportReason,
  type RoomVoiceMember,
} from "@ourdiu/shared/rooms";
import {
  ChevronDown,
  Headphones,
  Mic,
  MicOff,
  MoreHorizontal,
  PhoneOff,
  SendHorizontal,
  X,
} from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ContributorAvatar } from "~/components/contributor-avatar";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type {
  ChatLine,
  RoomConnection,
  RoomSnapshot,
} from "~/lib/rooms/connection";
import {
  firstName,
  pausedUntil,
  roomLine,
  sortVoice,
} from "~/lib/rooms/labels";
import { toast } from "~/lib/toast";
import { cn } from "~/lib/utils";

/** Tiles shown before the rest are "+N listening". */
const TILES = 14;

type Report = { person: RoomPerson; message?: string };

/**
 * A room, docked at the right on wide screens (the page stays usable beside it)
 * and a full-height sheet on phones: the voice call, then the chat.
 */
export default function RoomPanel({
  room,
  onClose,
}: {
  room: RoomConnection;
  onClose: () => void;
}) {
  const snapshot = useSyncExternalStore(
    room.subscribe,
    room.getSnapshot,
    room.getSnapshot,
  );
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [ban, setBan] = useState<RoomPerson | null>(null);

  useEffect(() => {
    room.setReading(true);
    return () => room.setReading(false);
  }, [room]);
  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { state } = snapshot;
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        onClick={onClose}
        aria-hidden
      />
      <section
        ref={panelRef}
        tabIndex={-1}
        aria-labelledby={titleId}
        className="fixed inset-x-0 top-10 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-[28px] bg-surface shadow-xl outline-none lg:inset-auto lg:top-20 lg:right-4 lg:bottom-4 lg:w-[25rem] lg:rounded-[28px]"
      >
        <div className="flex justify-center pt-2.5 lg:hidden" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-surface-highest" />
        </div>
        <header className="flex items-center gap-2 px-5 pt-3 pb-2 lg:pt-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate font-expressive text-xl">
              {snapshot.courseName} room
            </h2>
            <p className="text-sm text-muted-foreground">
              {state ? roomLine(state) : "Connecting…"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close the room"
          >
            <X className="max-lg:hidden" aria-hidden />
            <ChevronDown className="lg:hidden" aria-hidden />
          </Button>
        </header>

        {snapshot.closed ? (
          <div className="px-5 pb-5">
            <Alert>
              <AlertTitle>{snapshot.closed.message}</AlertTitle>
            </Alert>
          </div>
        ) : (
          <>
            <Voice
              room={room}
              snapshot={snapshot}
              onReport={(person) => setReport({ person })}
              onBan={setBan}
            />
            <Chat
              room={room}
              snapshot={snapshot}
              onReport={(person, message) => setReport({ person, message })}
            />
          </>
        )}
      </section>
      <ReportDialog
        courseId={snapshot.courseId}
        report={report}
        onClose={() => setReport(null)}
      />
      <AlertDialog open={!!ban} onOpenChange={(open) => !open && setBan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Ban {ban?.name} from course rooms?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They leave this room now and can't join any course room until an
              admin lets them back in (Admin → Course rooms).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (ban) room.send({ t: "remove", userId: ban.id, ban: true });
                setBan(null);
              }}
            >
              Ban
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Voice({
  room,
  snapshot,
  onReport,
  onBan,
}: {
  room: RoomConnection;
  snapshot: RoomSnapshot;
  onReport: (person: RoomPerson) => void;
  onBan: (person: RoomPerson) => void;
}) {
  const { state, voice, me } = snapshot;
  if (!state) return null;
  const inCall = voice.phase === "in";
  const mine = state.voice.find((v) => v.id === me?.id);
  const talking = state.voice.filter((v) => !v.muted).length;
  const members = sortVoice(state.voice, voice.speaking);
  const shown = members.slice(0, TILES);

  return (
    <div className="space-y-3 px-5 pb-4">
      {voice.micBlocked && (
        <Alert variant="destructive">
          <AlertTitle>Your browser blocked the microphone</AlertTitle>
          <AlertDescription>
            <p>
              Allow the microphone for this site (the icon beside the address),
              then try again. You can still chat.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => void room.voice.join()}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {shown.length > 0 && (
        <ul
          className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5"
          aria-label="In voice"
        >
          {shown.map((member) => (
            <li key={member.id}>
              <Person
                member={member}
                isMe={member.id === me?.id}
                speaking={voice.speaking.has(member.id)}
                mutedForMe={voice.mutedForMe.has(member.id)}
                canMuteForMe={inCall}
                admin={!!me?.admin}
                onMuteForMe={() => room.voice.toggleMuteForMe(member.id)}
                onReport={() => onReport(member)}
                onRemove={() =>
                  room.send({ t: "remove", userId: member.id, ban: false })
                }
                onBan={() => onBan(member)}
              />
            </li>
          ))}
          {members.length > TILES && (
            <li className="flex flex-col items-center gap-1.5">
              <span className="flex size-14 items-center justify-center rounded-full bg-surface-highest text-sm font-semibold">
                +{members.length - TILES}
              </span>
              <span className="text-xs text-muted-foreground">listening</span>
            </li>
          )}
        </ul>
      )}

      {inCall && mine ? (
        <>
          <p
            className="text-center text-xs text-muted-foreground"
            aria-live="polite"
          >
            {mine.muted
              ? talking >= ROOM_TALKER_LIMIT
                ? `${ROOM_TALKER_LIMIT} people are talking. Unmute when someone mutes.`
                : "You're muted. Tap the mic to talk."
              : "You're on. Others hear you."}
          </p>
          <div className="flex gap-2">
            <Button
              size="lg"
              className="h-13 flex-1 text-base"
              onClick={() => room.voice.toggleMute()}
              disabled={
                !mine.live || (mine.muted && talking >= ROOM_TALKER_LIMIT)
              }
              aria-pressed={!mine.muted}
            >
              {mine.muted ? <MicOff aria-hidden /> : <Mic aria-hidden />}
              {mine.muted ? "Unmute" : "Mute"}
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="h-13 bg-destructive/10 px-5 text-destructive hover:state-layer"
              onClick={() => room.voice.leave()}
            >
              <PhoneOff aria-hidden />
              Leave
            </Button>
          </div>
        </>
      ) : state.paused.voice ? (
        <Alert variant="warning">
          <AlertTitle>{pausedUntil(state)}</AlertTitle>
          <AlertDescription>
            This month's free allowance for calls is used up. Chat still works.
          </AlertDescription>
        </Alert>
      ) : !state.voiceAvailable ? (
        <Alert>
          <AlertTitle>Voice calls aren't set up yet</AlertTitle>
          <AlertDescription>
            Chat with classmates below meanwhile.
          </AlertDescription>
        </Alert>
      ) : state.voice.length >= ROOM_VOICE_LIMIT ? (
        <Alert variant="info">
          <AlertTitle>
            Voice is full ({state.voice.length}/{ROOM_VOICE_LIMIT})
          </AlertTitle>
          <AlertDescription>You can still chat.</AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-2">
          <Button
            size="lg"
            className="h-13 w-full text-base"
            onClick={() => void room.voice.join()}
            disabled={voice.phase !== "idle" || snapshot.status !== "open"}
          >
            <Headphones aria-hidden />
            {voice.phase === "starting"
              ? "Joining…"
              : state.voice.length
                ? "Join voice"
                : "Start a call"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            You'll join muted. Classmates see your name and photo.
          </p>
        </div>
      )}
    </div>
  );
}

function Person({
  member,
  isMe,
  speaking,
  mutedForMe,
  canMuteForMe,
  admin,
  onMuteForMe,
  onReport,
  onRemove,
  onBan,
}: {
  member: RoomVoiceMember;
  isMe: boolean;
  speaking: boolean;
  mutedForMe: boolean;
  canMuteForMe: boolean;
  admin: boolean;
  onMuteForMe: () => void;
  onReport: () => void;
  onRemove: () => void;
  onBan: () => void;
}) {
  const face = (
    <>
      <span className="relative">
        <span
          className={cn(
            "block rounded-full outline-3 outline-offset-3 outline-transparent transition-[outline-color]",
            speaking && "outline-primary",
            (member.muted || mutedForMe) && !speaking && "opacity-80",
          )}
        >
          <ContributorAvatar
            name={member.name}
            image={member.image}
            size="lg"
          />
        </span>
        {(member.muted || mutedForMe) && (
          <span className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-surface-highest text-muted-foreground ring-2 ring-surface">
            <MicOff className="size-3.5" aria-hidden />
          </span>
        )}
      </span>
      <span className="w-full truncate text-center text-xs font-semibold">
        {isMe ? "You" : firstName(member.name)}
      </span>
    </>
  );
  const status = `${member.name}${member.muted ? ", muted" : speaking ? ", talking" : ""}${mutedForMe ? ", muted for you" : ""}`;
  if (isMe) {
    return (
      <span
        className="flex flex-col items-center gap-1.5"
        aria-label={status}
        role="img"
      >
        {face}
      </span>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full flex-col items-center gap-1.5 rounded-2xl py-1 outline-none hover:state-layer focus-visible:state-layer"
        aria-label={status}
      >
        {face}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-56">
        <DropdownMenuLabel className="truncate">
          {member.name}
        </DropdownMenuLabel>
        {canMuteForMe && (
          <DropdownMenuItem onSelect={onMuteForMe}>
            {mutedForMe ? "Unmute for me" : "Mute for me"}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onReport}>Report</DropdownMenuItem>
        {admin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Admins
            </DropdownMenuLabel>
            <DropdownMenuItem variant="destructive" onSelect={onRemove}>
              Remove from the room
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onBan}>
              Ban from all rooms
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Chat({
  room,
  snapshot,
  onReport,
}: {
  room: RoomConnection;
  snapshot: RoomSnapshot;
  onReport: (person: RoomPerson, message: string) => void;
}) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLOListElement>(null);
  const stuck = useRef(true);
  const { chat, me, state } = snapshot;
  const paused = !!state?.paused.chat;
  const disabled = snapshot.status !== "open" || paused;

  // New messages scroll into view, unless you scrolled up to read.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && stuck.current) list.scrollTop = list.scrollHeight;
    room.markRead();
  }, [chat, room]);

  const send = (event: React.FormEvent) => {
    event.preventDefault();
    const message = text.trim();
    if (!message) return;
    if (room.chat(message)) setText("");
  };

  return (
    <div className="mx-2 mb-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-background">
      <p className="bg-surface-low px-4 py-2 text-center text-xs text-muted-foreground">
        Messages aren't saved. They disappear when you leave.
      </p>
      <ol
        ref={listRef}
        onScroll={(event) => {
          const el = event.currentTarget;
          stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3"
        aria-label="Chat"
        aria-live="polite"
      >
        {chat.length === 0 && (
          <li className="py-6 text-center text-sm text-muted-foreground">
            Say hello. Everyone on this course's pages can see the chat.
          </li>
        )}
        {chat.map((line) => (
          <ChatItem
            key={line.id}
            line={line}
            mine={line.kind === "message" && line.from.id === me?.id}
            onReport={onReport}
          />
        ))}
      </ol>
      <form
        onSubmit={send}
        className="flex gap-2 border-t border-surface-high p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]"
      >
        <label className="sr-only" htmlFor="room-message">
          Message
        </label>
        <input
          id="room-message"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={ROOM_CHAT_MAX_LENGTH}
          disabled={disabled}
          autoComplete="off"
          placeholder={paused ? "Chat is paused for now" : "Message the room"}
          className="h-11 min-w-0 flex-1 rounded-full border border-input bg-background px-4 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
        />
        <Button
          type="submit"
          size="icon-lg"
          className="size-11"
          disabled={disabled || !text.trim()}
          aria-label="Send"
        >
          <SendHorizontal aria-hidden />
        </Button>
      </form>
    </div>
  );
}

function ChatItem({
  line,
  mine,
  onReport,
}: {
  line: ChatLine;
  mine: boolean;
  onReport: (person: RoomPerson, message: string) => void;
}) {
  if (line.kind === "event") {
    return (
      <li className="text-center text-xs text-muted-foreground">{line.text}</li>
    );
  }
  const time = new Date(line.at).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  if (mine) {
    return (
      <li className="flex justify-end">
        <p className="max-w-[80%] rounded-[18px] rounded-br-md bg-primary-container px-3.5 py-2 text-sm break-words whitespace-pre-wrap text-primary-container-foreground">
          <span className="sr-only">You, {time}: </span>
          {line.text}
        </p>
      </li>
    );
  }
  return (
    <li className="group flex gap-2.5">
      <ContributorAvatar
        name={line.from.name}
        image={line.from.image}
        size="sm"
        className="mt-0.5 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">
            {line.from.name}
          </span>{" "}
          · {time}
        </p>
        <p className="text-sm break-words whitespace-pre-wrap">{line.text}</p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 outline-none group-hover:opacity-100 hover:state-layer focus-visible:state-layer focus-visible:opacity-100 data-[state=open]:opacity-100 max-lg:opacity-100"
          aria-label={`More for ${line.from.name}'s message`}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onReport(line.from, line.text)}>
            Report message
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function ReportDialog({
  courseId,
  report,
  onClose,
}: {
  courseId: number;
  report: Report | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<RoomReportReason>("harassment");
  const [sending, setSending] = useState(false);
  const submit = async () => {
    if (!report) return;
    setSending(true);
    try {
      const res = await fetch(`/api/v1/rooms/${courseId}/reports`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: report.person.id,
          reason,
          ...(report.message && { message: report.message }),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? "Couldn't send the report");
      }
      toast.success("Thanks. An admin will look at it.");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't send the report",
      );
    } finally {
      setSending(false);
    }
  };
  return (
    <Dialog open={!!report} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report {report?.person.name}</DialogTitle>
          <DialogDescription>
            {report?.message
              ? "Chat isn't saved, so this message is sent with your report for an admin to read."
              : "An admin will look at it. Calls aren't recorded."}
          </DialogDescription>
        </DialogHeader>
        {report?.message && (
          <blockquote className="rounded-2xl bg-surface px-4 py-3 text-sm break-words whitespace-pre-wrap">
            {report.message}
          </blockquote>
        )}
        <fieldset className="space-y-1">
          <legend className="mb-2 text-sm font-medium">What's wrong?</legend>
          {ROOM_REPORT_REASONS.map((value) => (
            <label
              key={value}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:state-layer"
            >
              <input
                type="radio"
                name="room-report-reason"
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
                className="size-4 accent-primary"
              />
              <span className="text-sm">
                {ROOM_REPORT_REASON_LABELS[value]}
              </span>
            </label>
          ))}
        </fieldset>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={sending}>
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
