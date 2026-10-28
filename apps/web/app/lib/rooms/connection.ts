import {
  ROOM_CLOSE,
  ROOM_FINAL_CLOSES,
  type RoomClientMessage,
  type RoomErrorCode,
  type RoomPerson,
  type RoomServerMessage,
  type RoomState,
} from "@ourdiu/shared/rooms";
import { firstName } from "./labels";
import { VoiceCall, type VoiceSnapshot } from "./voice";

export type ChatLine =
  | { kind: "message"; id: string; from: RoomPerson; text: string; at: number }
  | { kind: "event"; id: string; text: string };

export type RoomSnapshot = {
  courseId: number;
  courseName: string;
  status: "connecting" | "open" | "closed";
  /** Why the room closed for good (a ROOM_CLOSE code's error), if it did. */
  closed: { code: RoomErrorCode; message: string } | null;
  me: (RoomPerson & { admin: boolean }) | null;
  state: RoomState | null;
  chat: ChatLine[];
  /** Messages that came in while the panel was closed. */
  unread: number;
  voice: VoiceSnapshot;
};

/** Chat kept in the tab, oldest dropped first. It's never stored anywhere else. */
const CHAT_KEPT = 200;
const PING_MS = 30_000;

/**
 * A browser's connection to one course's room (`/api/v1/rooms/{id}/socket`): the
 * room's state, the chat since it connected, and the voice call. Reconnects after
 * drops, but not after a refusal (ROOM_CLOSE). Read with `useSyncExternalStore`.
 */
export class RoomConnection {
  private ws: WebSocket | null = null;
  private listeners = new Set<() => void>();
  private retries = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;
  private lastError: { code: RoomErrorCode; message: string } | null = null;
  /** Whether someone is reading the chat (the panel is open on this room). */
  private reading = false;
  readonly voice: VoiceCall;
  snapshot: RoomSnapshot;

  constructor(
    readonly courseId: number,
    courseName: string,
    private onError: (message: string) => void,
  ) {
    this.voice = new VoiceCall(
      (msg) => this.send(msg),
      () => this.emit({ voice: this.voice.snapshot }),
      onError,
    );
    this.snapshot = {
      courseId,
      courseName,
      status: "connecting",
      closed: null,
      me: null,
      state: null,
      chat: [],
      unread: 0,
      voice: this.voice.snapshot,
    };
    this.open();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  send(msg: RoomClientMessage) {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  chat(text: string) {
    return this.send({ t: "chat", text });
  }

  /** The panel opened (or closed) on this room: its messages aren't unread. */
  setReading(on: boolean) {
    this.reading = on;
    if (on) this.markRead();
  }

  markRead() {
    if (this.snapshot.unread) this.emit({ unread: 0 });
  }

  close() {
    this.disposed = true;
    this.voice.leave();
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.stopPing();
    this.ws?.close(1000);
    this.ws = null;
  }

  private emit(patch: Partial<RoomSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  private open() {
    const url = new URL(`/api/v1/rooms/${this.courseId}/socket`, location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(url);
    this.ws = ws;
    this.emit({ status: "connecting" });
    ws.addEventListener("open", () => {
      this.retries = 0;
      this.emit({ status: "open" });
      this.pingTimer = setInterval(() => ws.send("ping"), PING_MS);
    });
    ws.addEventListener("message", (event) => {
      if (event.data === "pong") return;
      this.receive(JSON.parse(event.data as string) as RoomServerMessage);
    });
    ws.addEventListener("close", (event) => {
      if (this.ws !== ws) return;
      this.stopPing();
      this.ws = null;
      this.voice.drop();
      if (this.disposed) return;
      if (ROOM_FINAL_CLOSES.includes(event.code)) {
        this.emit({
          status: "closed",
          closed: this.lastError ?? {
            code: event.code === ROOM_CLOSE.BANNED ? "BANNED" : "CLOSED",
            message: event.reason || "The room closed",
          },
        });
        return;
      }
      // Dropped (network, a deploy): try again, backing off up to half a minute.
      this.emit({ status: "connecting" });
      const delay = Math.min(30_000, 1000 * 2 ** this.retries++);
      this.retryTimer = setTimeout(
        () => this.open(),
        delay * (0.5 + Math.random()),
      );
    });
  }

  private stopPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private receive(msg: RoomServerMessage) {
    switch (msg.t) {
      case "hello":
        this.voice.me = msg.me.id;
        return this.emit({ me: msg.me });
      case "state": {
        const { t: _t, ...state } = msg;
        this.announceVoiceChanges(this.snapshot.state, state);
        this.emit({ state });
        this.voice.onState(state);
        return;
      }
      case "chat":
        return this.addChat(
          {
            kind: "message",
            id: msg.id,
            from: msg.from,
            text: msg.text,
            at: msg.at,
          },
          true,
        );
      case "error":
        this.lastError = { code: msg.code, message: msg.message };
        if (!ROOM_REFUSALS.has(msg.code))
          this.voice.onError(msg.code, msg.message);
        return;
      case "removed":
        this.lastError = {
          code: msg.ban ? "BANNED" : "CLOSED",
          message: msg.ban
            ? "An admin has kept you out of course rooms"
            : "An admin took you out of this room",
        };
        return;
      default:
        this.voice.onMessage(msg);
    }
  }

  private addChat(line: ChatLine, unread = false) {
    const chat = [...this.snapshot.chat, line].slice(-CHAT_KEPT);
    this.emit({
      chat,
      unread: this.snapshot.unread + (unread && !this.reading ? 1 : 0),
    });
  }

  /** "Nadia joined voice", in the chat, for people already here. */
  private announceVoiceChanges(before: RoomState | null, after: RoomState) {
    if (!before) return;
    const was = new Map(before.voice.map((v) => [v.id, v.name]));
    const now = new Map(after.voice.map((v) => [v.id, v.name]));
    const me = this.snapshot.me?.id;
    for (const [id, name] of now) {
      if (!was.has(id) && id !== me) {
        this.addChat({
          kind: "event",
          id: `${id}-in-${Date.now()}`,
          text: `${firstName(name)} joined voice`,
        });
      }
    }
    for (const [id, name] of was) {
      if (!now.has(id) && id !== me) {
        this.addChat({
          kind: "event",
          id: `${id}-out-${Date.now()}`,
          text: `${firstName(name)} left voice`,
        });
      }
    }
  }
}

/** Errors sent just before a refused connection closes (the snapshot's `closed`). */
const ROOM_REFUSALS = new Set<RoomErrorCode>([
  "SIGNED_OUT",
  "DIU_ONLY",
  "BANNED",
  "CLOSED",
  "BUSY",
  "NOT_FOUND",
]);
