import { DurableObject } from "cloudflare:workers";
import { roomClientMessageSchema, type RoomSummary } from "@ourdiu/shared";
import {
  ROOM_CHAT_BURST,
  ROOM_CHAT_MAX_LENGTH,
  ROOM_CHAT_WINDOW_MS,
  ROOM_CLOSE,
  ROOM_SOCKET_LIMIT,
  ROOM_TALKER_LIMIT,
  ROOM_VOICE_LIMIT,
  type RoomErrorCode,
  type RoomServerMessage,
  type RoomState,
  type RoomVoiceLeftReason,
} from "@ourdiu/shared/rooms";
import { createDb } from "../../db/client";
import { roomBans } from "../../db/schema";
import { refuseSocket } from "./refuse";
import { createSfu, SfuError, type Sfu } from "./sfu";
import { ROOM_USER_HEADER, type RoomUser } from "./user";
import {
  addUsage,
  BYTES_PER_STREAM_SECOND,
  roomLimits,
  roomPause,
  usageCycle,
  type RoomPause,
} from "./usage";

/** While anyone is in voice (or usage is waiting), usage is flushed this often. */
const FLUSH_MS = 60_000;
/** How long a pause check is trusted before it's read from D1 again. */
const PAUSE_TTL_MS = 60_000;

type Voice = { sessionId: string; live: boolean; muted: boolean };
type Attachment = {
  user: RoomUser;
  voice: Voice | null;
  chat: { start: number; count: number };
};
type Usage = {
  voiceBytes: number;
  voiceSeconds: number;
  messages: number;
  /** When voice usage was last added up. */
  since: number;
};
type CachedPause = RoomPause & { checkedAt: number };

const OPEN = 1;

/**
 * One course's room (docs/PLAN.md, decision 66): who's connected, the chat, and the
 * voice call's signalling with the Realtime SFU. Chat is relayed and forgotten;
 * storage holds only the usage waiting to be flushed to D1 and the last pause
 * check. Sockets are hibernatable, so an idle room isn't billed for its time.
 */
export class CourseRoom extends DurableObject<Env> {
  private pauseMemo: CachedPause | null | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Keep-alives answered without waking the room.
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong"),
    );
  }

  override async fetch(request: Request) {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket", { status: 426 });
    }
    const user = JSON.parse(
      request.headers.get(ROOM_USER_HEADER) ?? "null",
    ) as RoomUser | null;
    if (!user) return new Response("No user", { status: 400 });
    if (this.sockets().length >= ROOM_SOCKET_LIMIT) {
      return refuseSocket(
        "BUSY",
        ROOM_CLOSE.BUSY,
        "This room is busy. Try again soon.",
      );
    }
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server, [user.id]);
    server.serializeAttachment({
      user,
      voice: null,
      chat: { start: 0, count: 0 },
    } satisfies Attachment);
    await this.pause();
    this.send(server, { t: "hello", me: user });
    this.broadcastState();
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Counts for anyone, without names (`GET /rooms/{courseId}`). */
  summary(): RoomSummary {
    const voice = this.voiceSockets();
    return {
      voice: voice.length,
      talking: voice.filter((ws) => !this.attachment(ws).voice!.muted).length,
      here: this.people(),
    };
  }

  /** Takes someone out of this room (an admin's ban from the reports page). */
  async kick(userId: string, ban: boolean) {
    await this.loadPause();
    await this.removeSockets(userId, ban);
  }

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    await this.loadPause();
    await this.countMessage();
    if (typeof raw !== "string") return;
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return this.error(ws, "INVALID", "Not a message");
    }
    const parsed = roomClientMessageSchema.safeParse(json);
    if (!parsed.success) return this.error(ws, "INVALID", "Not a message");
    const msg = parsed.data;
    try {
      switch (msg.t) {
        case "chat":
          return await this.chat(ws, msg.text);
        case "voice.join":
          return await this.joinVoice(ws);
        case "voice.leave":
          if (this.attachment(ws).voice) await this.leaveVoice(ws, "left");
          return this.broadcastState();
        case "voice.mute":
          return await this.mute(ws, msg.muted);
        case "sfu.push":
          return await this.push(ws, msg.sdp, msg.mid);
        case "sfu.pull":
          return await this.pull(ws, msg.userIds);
        case "sfu.answer":
          return await this.answer(ws, msg.sdp);
        case "remove":
          return await this.remove(ws, msg.userId, msg.ban);
      }
    } catch (error) {
      if (!(error instanceof SfuError)) throw error;
      console.error(error.message);
      // Admins also see what Cloudflare said, to tell a setup problem from a hiccup.
      const detail = this.attachment(ws).user.admin
        ? ` (Cloudflare: ${error.short})`
        : "";
      this.error(
        ws,
        "SFU_ERROR",
        `The call couldn't connect. Try again.${detail}`,
      );
    }
  }

  override async webSocketClose(ws: WebSocket) {
    await this.dropSocket(ws);
  }

  override async webSocketError(ws: WebSocket) {
    await this.dropSocket(ws);
  }

  /** Flushes usage to D1, checks the caps and keeps going while voice is on. */
  override async alarm() {
    await this.accrue();
    const usage = await this.usage();
    const limits = roomLimits(this.env);
    const { start } = usageCycle(new Date(), limits.cycleDay);
    await addUsage(createDb(this.env.DB), start, usage);
    await this.ctx.storage.put<Usage>("usage", {
      voiceBytes: 0,
      voiceSeconds: 0,
      messages: 0,
      since: usage.since,
    });
    await this.pause(true);
    if (this.voiceSockets().length > 0) {
      await this.ctx.storage.setAlarm(Date.now() + FLUSH_MS);
    }
  }

  // ── Messages ────────────────────────────────────────────────────────────────

  private async chat(ws: WebSocket, raw: string) {
    const text = raw.trim();
    if (!text || text.length > ROOM_CHAT_MAX_LENGTH) {
      return this.error(
        ws,
        "INVALID",
        `Messages are 1–${ROOM_CHAT_MAX_LENGTH} characters`,
      );
    }
    if ((await this.pause()).chat) {
      return this.error(ws, "CHAT_PAUSED", "Chat is paused for now");
    }
    const att = this.attachment(ws);
    const now = Date.now();
    if (now - att.chat.start > ROOM_CHAT_WINDOW_MS)
      att.chat = { start: now, count: 0 };
    if (att.chat.count >= ROOM_CHAT_BURST) {
      return this.error(ws, "TOO_FAST", "You're sending messages too fast");
    }
    att.chat.count += 1;
    ws.serializeAttachment(att);
    const { id, name, image } = att.user;
    this.broadcast({
      t: "chat",
      id: crypto.randomUUID(),
      from: { id, name, image },
      text,
      at: now,
    });
  }

  private async joinVoice(ws: WebSocket) {
    const att = this.attachment(ws);
    if (att.voice) {
      return this.send(ws, {
        t: "voice.joined",
        sessionId: att.voice.sessionId,
      });
    }
    const sfu = this.sfu();
    if (!sfu) {
      return this.error(
        ws,
        "VOICE_UNAVAILABLE",
        "Voice calls aren't set up yet",
      );
    }
    if ((await this.pause(true)).voice) {
      return this.error(ws, "VOICE_PAUSED", "Voice calls are paused for now");
    }
    const mine = this.voiceSockets().filter(
      (other) => this.attachment(other).user.id === att.user.id,
    );
    if (this.voiceSockets().length - mine.length >= ROOM_VOICE_LIMIT) {
      return this.error(
        ws,
        "VOICE_FULL",
        `Voice is full (${ROOM_VOICE_LIMIT})`,
      );
    }
    // One call per person: another tab of theirs leaves it.
    for (const other of mine) await this.leaveVoice(other, "moved");
    const sessionId = await sfu.newSession();
    if (ws.readyState !== OPEN) return;
    await this.accrue();
    const fresh = this.attachment(ws);
    fresh.voice = { sessionId, live: false, muted: true };
    ws.serializeAttachment(fresh);
    this.send(ws, { t: "voice.joined", sessionId });
    this.broadcastState();
    await this.ensureAlarm();
  }

  private async push(ws: WebSocket, sdp: string, mid: string) {
    const voice = this.attachment(ws).voice;
    if (!voice) return this.error(ws, "NOT_IN_VOICE", "Join voice first");
    // One microphone per call.
    if (voice.live) return this.error(ws, "INVALID", "Already connected");
    const res = await this.sfu()!.tracks(
      voice.sessionId,
      [{ location: "local", mid, trackName: "mic" }],
      { type: "offer", sdp },
    );
    if (!res.sessionDescription) {
      throw new SfuError("POST /tracks/new", 200, "NO_ANSWER");
    }
    this.send(ws, { t: "sfu.answer", sdp: res.sessionDescription.sdp });
    const att = this.attachment(ws);
    if (att.voice?.sessionId !== voice.sessionId) return;
    att.voice.live = true;
    ws.serializeAttachment(att);
    this.broadcastState();
  }

  private async pull(ws: WebSocket, userIds: string[]) {
    const att = this.attachment(ws);
    if (!att.voice) return this.error(ws, "NOT_IN_VOICE", "Join voice first");
    const wanted = new Set(userIds);
    wanted.delete(att.user.id);
    const sessions = new Map<string, string>();
    for (const other of this.voiceSockets()) {
      const { user, voice } = this.attachment(other);
      if (wanted.has(user.id) && voice!.live)
        sessions.set(voice!.sessionId, user.id);
    }
    if (sessions.size === 0) return;
    const res = await this.sfu()!.tracks(
      att.voice.sessionId,
      [...sessions.keys()].map((sessionId) => ({
        location: "remote" as const,
        sessionId,
        trackName: "mic",
      })),
    );
    if (!res.sessionDescription) return;
    const tracks = (res.tracks ?? []).flatMap((track) => {
      const userId = track.sessionId && sessions.get(track.sessionId);
      return track.mid && userId && !track.errorCode
        ? [{ mid: track.mid, userId }]
        : [];
    });
    this.send(ws, { t: "sfu.offer", sdp: res.sessionDescription.sdp, tracks });
  }

  private async answer(ws: WebSocket, sdp: string) {
    const voice = this.attachment(ws).voice;
    if (!voice) return this.error(ws, "NOT_IN_VOICE", "Join voice first");
    await this.sfu()!.renegotiate(voice.sessionId, { type: "answer", sdp });
  }

  private async mute(ws: WebSocket, muted: boolean) {
    const att = this.attachment(ws);
    if (!att.voice) return this.error(ws, "NOT_IN_VOICE", "Join voice first");
    if (att.voice.muted === muted) return this.broadcastState();
    if (!muted) {
      if (!att.voice.live) return this.error(ws, "INVALID", "Still connecting");
      if ((await this.pause()).voice) {
        return this.error(ws, "VOICE_PAUSED", "Voice calls are paused for now");
      }
      const talking = this.voiceSockets().filter(
        (other) => other !== ws && !this.attachment(other).voice!.muted,
      ).length;
      if (talking >= ROOM_TALKER_LIMIT) {
        return this.error(
          ws,
          "TALKERS_FULL",
          `${ROOM_TALKER_LIMIT} people are talking. Unmute when someone mutes.`,
        );
      }
    }
    await this.accrue();
    const fresh = this.attachment(ws);
    if (!fresh.voice) return;
    fresh.voice.muted = muted;
    ws.serializeAttachment(fresh);
    this.broadcastState();
  }

  private async remove(ws: WebSocket, userId: string, ban: boolean) {
    const admin = this.attachment(ws).user;
    if (!admin.admin)
      return this.error(ws, "FORBIDDEN", "Only admins can do that");
    if (ban) {
      await createDb(this.env.DB)
        .insert(roomBans)
        .values({ userId, bannedBy: admin.id })
        .onConflictDoNothing();
    }
    await this.removeSockets(userId, ban);
  }

  private async removeSockets(userId: string, ban: boolean) {
    for (const target of this.ctx.getWebSockets(userId)) {
      if (this.attachment(target).voice)
        await this.leaveVoice(target, "removed");
      this.send(target, { t: "removed", ban });
      try {
        target.close(
          ban ? ROOM_CLOSE.BANNED : ROOM_CLOSE.REMOVED,
          ban ? "Banned" : "Removed",
        );
      } catch {
        // Already closing.
      }
    }
    this.broadcastState(this.ctx.getWebSockets(userId));
  }

  // ── Voice and usage ─────────────────────────────────────────────────────────

  private async leaveVoice(ws: WebSocket, reason: RoomVoiceLeftReason) {
    await this.accrue(ws);
    const att = this.attachment(ws);
    att.voice = null;
    ws.serializeAttachment(att);
    this.send(ws, { t: "voice.left", reason });
  }

  private async dropSocket(ws: WebSocket) {
    await this.loadPause();
    if (this.attachment(ws).voice) await this.accrue(ws);
    try {
      ws.close();
    } catch {
      // Already closed.
    }
    this.broadcastState([ws]);
  }

  /**
   * Adds voice usage since the last change: each unmuted talker reaches everyone
   * else in the call. `closing` is a socket that still counts for the time since.
   */
  private async accrue(closing?: WebSocket) {
    const usage = await this.usage();
    const now = Date.now();
    const voice = this.voiceSockets();
    if (closing && !voice.includes(closing) && this.attachment(closing).voice) {
      voice.push(closing);
    }
    const seconds = Math.max(0, (now - usage.since) / 1000);
    const talkers = voice.filter(
      (ws) => !this.attachment(ws).voice!.muted,
    ).length;
    usage.voiceBytes +=
      seconds *
      talkers *
      Math.max(0, voice.length - 1) *
      BYTES_PER_STREAM_SECOND;
    usage.voiceSeconds += seconds * voice.length;
    usage.since = now;
    await this.ctx.storage.put("usage", usage);
  }

  private async countMessage() {
    const usage = await this.usage();
    usage.messages += 1;
    await this.ctx.storage.put("usage", usage);
    await this.ensureAlarm();
  }

  private async usage(): Promise<Usage> {
    return (
      (await this.ctx.storage.get<Usage>("usage")) ?? {
        voiceBytes: 0,
        voiceSeconds: 0,
        messages: 0,
        since: Date.now(),
      }
    );
  }

  private async ensureAlarm() {
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + FLUSH_MS);
    }
  }

  /**
   * What's paused, from D1 at most once a PAUSE_TTL_MS (or now, with `fresh`).
   * A new pause ends the call for everyone.
   */
  private async pause(fresh = false): Promise<RoomPause> {
    await this.loadPause();
    const cached = this.pauseMemo;
    if (!fresh && cached && Date.now() - cached.checkedAt < PAUSE_TTL_MS) {
      return cached;
    }
    const pause = await roomPause(createDb(this.env.DB), roomLimits(this.env));
    this.pauseMemo = { ...pause, checkedAt: Date.now() };
    await this.ctx.storage.put<CachedPause>("pause", this.pauseMemo);
    if (pause.voice) {
      for (const ws of this.voiceSockets()) await this.leaveVoice(ws, "paused");
    }
    if (
      !cached ||
      cached.voice !== pause.voice ||
      cached.chat !== pause.chat ||
      cached.until !== pause.until
    ) {
      this.broadcastState();
    }
    return pause;
  }

  // ── Sockets ─────────────────────────────────────────────────────────────────

  private sfu(): Sfu | null {
    const { REALTIME_APP_ID, REALTIME_APP_TOKEN } = this.env;
    return REALTIME_APP_ID && REALTIME_APP_TOKEN
      ? createSfu(REALTIME_APP_ID, REALTIME_APP_TOKEN)
      : null;
  }

  private sockets(except: WebSocket[] = []) {
    return this.ctx
      .getWebSockets()
      .filter((ws) => ws.readyState === OPEN && !except.includes(ws));
  }

  private voiceSockets() {
    return this.sockets().filter((ws) => this.attachment(ws).voice);
  }

  private people(except: WebSocket[] = []) {
    return new Set(
      this.sockets(except).map((ws) => this.attachment(ws).user.id),
    ).size;
  }

  private attachment(ws: WebSocket) {
    return ws.deserializeAttachment() as Attachment;
  }

  /** The last pause check, kept in memory too (it's lost when the room hibernates). */
  private async loadPause() {
    if (this.pauseMemo === undefined) {
      this.pauseMemo =
        (await this.ctx.storage.get<CachedPause>("pause")) ?? null;
    }
  }

  private state(except: WebSocket[], pause: RoomPause | null): RoomState {
    return {
      voice: this.sockets(except).flatMap((ws) => {
        const { user, voice } = this.attachment(ws);
        return voice
          ? [
              {
                id: user.id,
                name: user.name,
                image: user.image,
                muted: voice.muted,
                live: voice.live,
              },
            ]
          : [];
      }),
      here: this.people(except),
      voiceAvailable: roomLimits(this.env).voiceAvailable,
      paused: { voice: pause?.voice ?? false, chat: pause?.chat ?? false },
      pausedUntil: pause?.until ?? null,
    };
  }

  private broadcastState(except: WebSocket[] = []) {
    const state = this.state(except, this.pauseMemo ?? null);
    for (const ws of this.sockets(except))
      this.send(ws, { t: "state", ...state });
  }

  private broadcast(msg: RoomServerMessage) {
    for (const ws of this.sockets()) this.send(ws, msg);
  }

  private send(ws: WebSocket, msg: RoomServerMessage) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // Closed meanwhile.
    }
  }

  private error(ws: WebSocket, code: RoomErrorCode, message: string) {
    this.send(ws, { t: "error", code, message });
  }
}
