import { env, runInDurableObject } from "cloudflare:test";
import type { RoomServerMessage, RoomState } from "@ourdiu/shared/rooms";
import {
  ROOM_CHAT_BURST,
  ROOM_CLOSE,
  ROOM_TALKER_LIMIT,
} from "@ourdiu/shared/rooms";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  roomBans,
  roomReports,
  roomSettings,
  roomUsage,
} from "../src/db/schema";
import { courseRoom } from "../src/routes/rooms";
import { roomLimits, usageCycle } from "../src/services/rooms/usage";
import {
  api,
  db,
  jsonRequest,
  seedTaxonomy,
  signIn,
  signInAdmin,
} from "./helpers";

type Msg = RoomServerMessage;

/** A WebSocket into a room, with the messages it has received. */
async function connect(courseId: number, cookie?: string) {
  const res = await api(`/api/v1/rooms/${courseId}/socket`, {
    headers: { upgrade: "websocket", ...(cookie && { cookie }) },
  });
  expect(res.status).toBe(101);
  const ws = res.webSocket!;
  const received: Msg[] = [];
  const waiters: { test: (m: Msg) => boolean; resolve: (m: Msg) => void }[] =
    [];
  let closed: { code: number } | null = null;
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data as string) as Msg;
    received.push(msg);
    for (const w of [...waiters]) {
      if (w.test(msg)) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(msg);
      }
    }
  });
  ws.addEventListener("close", (event) => {
    closed = { code: event.code };
  });
  ws.accept();
  return {
    ws,
    received,
    get closed() {
      return closed;
    },
    send(msg: object) {
      ws.send(JSON.stringify(msg));
    },
    /** The first message (already received or to come) that matches. */
    next<T extends Msg["t"]>(
      t: T,
      test: (m: Extract<Msg, { t: T }>) => boolean = () => true,
      { fresh = false } = {},
    ): Promise<Extract<Msg, { t: T }>> {
      const match = (m: Msg) => m.t === t && test(m as Extract<Msg, { t: T }>);
      const seen = fresh ? undefined : received.find(match);
      if (seen) return Promise.resolve(seen as Extract<Msg, { t: T }>);
      return new Promise((resolve, reject) => {
        waiters.push({ test: match, resolve: resolve as (m: Msg) => void });
        setTimeout(() => reject(new Error(`No ${t} message`)), 3000);
      });
    },
    lastState() {
      return [...received].reverse().find((m) => m.t === "state") as
        (RoomState & { t: "state" }) | undefined;
    },
  };
}

type Conn = Awaited<ReturnType<typeof connect>>;

const settle = () => new Promise((r) => setTimeout(r, 50));

/** Fake Realtime SFU: sessions s-1, s-2, …; pulled tracks get mids in order. */
let sfuCalls: { method: string; path: string; body: unknown }[] = [];
beforeEach(() => {
  sfuCalls = [];
  let sessions = 0;
  const realFetch = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const prefix = "https://rtc.live.cloudflare.com/v1/apps/test-sfu-app";
    if (!url.startsWith(prefix)) return realFetch(input, init);
    const path = url.slice(prefix.length);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    sfuCalls.push({ method: init?.method ?? "GET", path, body });
    if (path === "/sessions/new") {
      sessions += 1;
      return Response.json({
        sessionId: `s-${crypto.randomUUID()}-${sessions}`,
      });
    }
    if (path.endsWith("/tracks/new")) {
      const tracks = body.tracks as { location: string; sessionId?: string }[];
      if (tracks[0]!.location === "local") {
        return Response.json({
          sessionDescription: { type: "answer", sdp: "answer-sdp" },
          tracks: [{ mid: "0", trackName: "mic" }],
        });
      }
      return Response.json({
        requiresImmediateRenegotiation: true,
        sessionDescription: { type: "offer", sdp: "offer-sdp" },
        tracks: tracks.map((t, i) => ({
          mid: String(i + 1),
          trackName: "mic",
          sessionId: t.sessionId,
        })),
      });
    }
    if (path.endsWith("/renegotiate")) return Response.json({});
    return new Response("not found", { status: 404 });
  });
});
afterEach(() => vi.restoreAllMocks());

/** Joins voice and publishes a microphone track, so they can unmute. */
async function joinVoice(conn: Conn) {
  conn.send({ t: "voice.join" });
  await conn.next("voice.joined");
  conn.send({ t: "sfu.push", sdp: "offer", mid: "0" });
  await conn.next("sfu.answer");
}

async function course() {
  return (await seedTaxonomy()).algorithms.id;
}

describe("GET /api/v1/rooms/{courseId}/socket", () => {
  it("refuses people who aren't signed in, without a DIU address, or banned", async () => {
    const id = await course();
    expect((await api(`/api/v1/rooms/${id}/socket`)).status).toBe(401);
    const reader = await signIn(`reader-${crypto.randomUUID()}@gmail.com`);
    const res = await api(`/api/v1/rooms/${id}/socket`, {
      headers: { cookie: reader.cookie },
    });
    expect(res.status).toBe(403);
    expect((await res.json<{ error: { code: string } }>()).error.code).toBe(
      "DIU_ONLY",
    );

    // Over a WebSocket, the refusal is readable: an error, then a 4xxx close.
    const refused = await connect(id, reader.cookie);
    expect(await refused.next("error")).toMatchObject({ code: "DIU_ONLY" });
    await settle();
    expect(refused.closed?.code).toBe(ROOM_CLOSE.DIU_ONLY);

    const banned = await signIn();
    await db().insert(roomBans).values({ userId: banned.id });
    const bannedConn = await connect(id, banned.cookie);
    expect(await bannedConn.next("error")).toMatchObject({ code: "BANNED" });
  });

  it("needs a WebSocket and a real course", async () => {
    const student = await signIn();
    const id = await course();
    expect(
      (
        await api(`/api/v1/rooms/${id}/socket`, {
          headers: { cookie: student.cookie },
        })
      ).status,
    ).toBe(426);
    expect(
      (
        await api(`/api/v1/rooms/99999999/socket`, {
          headers: { cookie: student.cookie },
        })
      ).status,
    ).toBe(404);
  });

  it("shows who's here and relays chat without storing it", async () => {
    const id = await course();
    const a = await signIn(undefined, "Nadia");
    const b = await signIn(undefined, "Tanvir");
    const nadia = await connect(id, a.cookie);
    expect(await nadia.next("hello")).toMatchObject({
      me: { id: a.id, name: "Nadia", admin: false },
    });
    const tanvir = await connect(id, b.cookie);
    await nadia.next("state", (s) => s.here === 2);
    // A second tab of the same person is still one person here.
    await connect(id, b.cookie);
    await settle();
    expect(nadia.lastState()?.here).toBe(2);

    tanvir.send({ t: "chat", text: "  Anyone solved Q3?  " });
    const got = await nadia.next("chat");
    expect(got).toMatchObject({
      text: "Anyone solved Q3?",
      from: { id: b.id, name: "Tanvir" },
    });

    // Nothing in the room's storage holds the message.
    await runInDurableObject(courseRoom(env, id), async (_room, state) => {
      const stored = JSON.stringify([
        ...(await state.storage.list()).entries(),
      ]);
      expect(stored).not.toContain("Anyone solved");
    });
  });

  it("limits how fast someone can chat", async () => {
    const id = await course();
    const conn = await connect(id, (await signIn()).cookie);
    await conn.next("hello");
    for (let i = 0; i <= ROOM_CHAT_BURST; i++)
      conn.send({ t: "chat", text: `m${i}` });
    expect(await conn.next("error")).toMatchObject({ code: "TOO_FAST" });
    await settle();
    expect(conn.received.filter((m) => m.t === "chat")).toHaveLength(
      ROOM_CHAT_BURST,
    );
  });

  it("runs a voice call through the SFU", async () => {
    const id = await course();
    const a = await signIn(undefined, "Nadia");
    const b = await signIn(undefined, "Tanvir");
    const nadia = await connect(id, a.cookie);
    const tanvir = await connect(id, b.cookie);
    await joinVoice(nadia);
    await joinVoice(tanvir);

    // Joined muted, live once the microphone's track is pushed.
    const state = await nadia.next(
      "state",
      (s) => s.voice.length === 2 && s.voice.every((v) => v.live),
    );
    expect(state.voice.every((v) => v.muted)).toBe(true);
    const push = sfuCalls.find((call) => call.path.endsWith("/tracks/new"));
    expect(push?.body).toMatchObject({
      sessionDescription: { type: "offer", sdp: "offer" },
      tracks: [{ location: "local", mid: "0", trackName: "mic" }],
    });

    nadia.send({ t: "voice.mute", muted: false });
    await tanvir.next("state", (s) =>
      s.voice.some((v) => v.id === a.id && !v.muted),
    );

    // Tanvir hears Nadia: her track is added to his session, then he answers.
    tanvir.send({ t: "sfu.pull", userIds: [a.id, "someone-not-here"] });
    const offer = await tanvir.next("sfu.offer");
    expect(offer).toMatchObject({
      sdp: "offer-sdp",
      tracks: [{ mid: "1", userId: a.id }],
    });
    tanvir.send({ t: "sfu.answer", sdp: "answer" });
    await settle();
    expect(sfuCalls.at(-1)).toMatchObject({
      method: "PUT",
      body: { sessionDescription: { type: "answer", sdp: "answer" } },
    });

    // The summary counts them, without names.
    const summary = await api(`/api/v1/rooms/${id}`);
    expect(await summary.json()).toEqual({ voice: 2, talking: 1, here: 2 });

    nadia.send({ t: "voice.leave" });
    expect(await nadia.next("voice.left")).toMatchObject({ reason: "left" });
    await tanvir.next("state", (s) => s.voice.length === 1);
  });

  it("keeps one call per person: another tab of theirs leaves it", async () => {
    const id = await course();
    const a = await signIn();
    const first = await connect(id, a.cookie);
    const second = await connect(id, a.cookie);
    await joinVoice(first);
    second.send({ t: "voice.join" });
    expect(await first.next("voice.left")).toMatchObject({ reason: "moved" });
    await second.next("voice.joined");
  });

  it(`lets ${ROOM_TALKER_LIMIT} talk at once`, async () => {
    const id = await course();
    const conns: Conn[] = [];
    for (let i = 0; i <= ROOM_TALKER_LIMIT; i++) {
      const conn = await connect(id, (await signIn()).cookie);
      await joinVoice(conn);
      conns.push(conn);
    }
    for (const conn of conns.slice(0, ROOM_TALKER_LIMIT)) {
      conn.send({ t: "voice.mute", muted: false });
    }
    await conns[0]!.next(
      "state",
      (s) => s.voice.filter((v) => !v.muted).length === ROOM_TALKER_LIMIT,
    );
    const last = conns.at(-1)!;
    last.send({ t: "voice.mute", muted: false });
    expect(await last.next("error")).toMatchObject({ code: "TALKERS_FULL" });
  });

  it("can't unmute before the microphone is on the SFU, or be heard outside voice", async () => {
    const id = await course();
    const conn = await connect(id, (await signIn()).cookie);
    conn.send({ t: "voice.mute", muted: false });
    expect(await conn.next("error")).toMatchObject({ code: "NOT_IN_VOICE" });
    conn.send({ t: "sfu.pull", userIds: ["x"] });
    await settle();
    conn.send({ t: "voice.join" });
    await conn.next("voice.joined");
    conn.send({ t: "voice.mute", muted: false });
    expect(
      await conn.next("error", (e) => e.code === "INVALID", { fresh: true }),
    ).toBeTruthy();
  });

  it("lets an admin remove or ban someone", async () => {
    const id = await course();
    const admin = await signInAdmin();
    const troll = await signIn();
    const adminConn = await connect(id, admin.cookie);
    const trollConn = await connect(id, troll.cookie);
    await joinVoice(trollConn);

    // Not an admin: refused.
    trollConn.send({ t: "remove", userId: admin.id, ban: false });
    expect(await trollConn.next("error")).toMatchObject({ code: "FORBIDDEN" });

    adminConn.send({ t: "remove", userId: troll.id, ban: true });
    expect(await trollConn.next("removed")).toEqual({
      t: "removed",
      ban: true,
    });
    await settle();
    expect(trollConn.closed?.code).toBe(ROOM_CLOSE.BANNED);
    await adminConn.next("state", (s) => s.here === 1 && s.voice.length === 0);
    const [ban] = await db()
      .select()
      .from(roomBans)
      .where(eq(roomBans.userId, troll.id));
    expect(ban?.bannedBy).toBe(admin.id);
  });
});

describe("pausing at the free allowance", () => {
  const cycle = () => usageCycle(new Date(), roomLimits(env).cycleDay).start;

  afterEach(async () => {
    await db().delete(roomUsage);
    await db().delete(roomSettings);
  });

  it("refuses voice once the cycle's estimate reaches the cap", async () => {
    await db()
      .insert(roomUsage)
      .values({ cycle: cycle(), voiceBytes: roomLimits(env).voiceBytesCap });
    const conn = await connect(await course(), (await signIn()).cookie);
    expect(await conn.next("state")).toMatchObject({
      paused: { voice: true, chat: false },
    });
    expect(conn.lastState()?.pausedUntil).toBe(
      usageCycle(new Date(), roomLimits(env).cycleDay).next,
    );
    conn.send({ t: "voice.join" });
    expect(await conn.next("error")).toMatchObject({ code: "VOICE_PAUSED" });
    // Chat still works.
    conn.send({ t: "chat", text: "still here" });
    await conn.next("chat");
  });

  it("an admin's pause stops voice and chat", async () => {
    const admin = await signInAdmin();
    const res = await api(
      "/api/v1/admin/rooms/settings",
      jsonRequest("PUT", { paused: true }, admin.cookie),
    );
    expect(res.status).toBe(204);
    const conn = await connect(await course(), (await signIn()).cookie);
    expect(await conn.next("state")).toMatchObject({
      paused: { voice: true, chat: true },
      pausedUntil: null,
    });
    conn.send({ t: "chat", text: "hello?" });
    expect(await conn.next("error")).toMatchObject({ code: "CHAT_PAUSED" });
  });

  it("adds up usage and flushes it to D1 on the alarm", async () => {
    const id = await course();
    const a = await connect(id, (await signIn()).cookie);
    const b = await connect(id, (await signIn()).cookie);
    await joinVoice(a);
    await joinVoice(b);
    a.send({ t: "voice.mute", muted: false });
    await b.next("state", (s) => s.voice.some((v) => !v.muted));
    // A minute of one talker and one listener.
    await runInDurableObject(courseRoom(env, id), async (room, state) => {
      const usage = (await state.storage.get<{ since: number }>("usage"))!;
      await state.storage.put("usage", {
        ...usage,
        since: usage.since - 60_000,
      });
      await room.alarm();
    });
    const [row] = await db()
      .select()
      .from(roomUsage)
      .where(eq(roomUsage.cycle, cycle()));
    expect(row!.voiceBytes).toBeGreaterThanOrEqual(60 * 6_500);
    expect(row!.voiceSeconds).toBeGreaterThanOrEqual(120);
    expect(row!.messages).toBeGreaterThan(0);
  });
});

describe("usageCycle", () => {
  it("runs from the billing day to the same day next month", () => {
    expect(usageCycle(new Date("2026-10-28T10:00:00Z"), 1)).toEqual({
      start: "2026-10-01",
      next: "2026-11-01",
    });
    expect(usageCycle(new Date("2026-10-03T10:00:00Z"), 15)).toEqual({
      start: "2026-09-15",
      next: "2026-10-15",
    });
    expect(usageCycle(new Date("2026-12-20T00:00:00Z"), 15)).toEqual({
      start: "2026-12-15",
      next: "2027-01-15",
    });
  });
});

describe("POST /api/v1/rooms/{courseId}/reports", () => {
  it("files a report for admins, who can ban from it", async () => {
    const id = await course();
    const reporter = await signIn();
    const reported = await signIn();
    const res = await api(
      `/api/v1/rooms/${id}/reports`,
      jsonRequest(
        "POST",
        { userId: reported.id, reason: "harassment", message: "rude message" },
        reporter.cookie,
      ),
    );
    expect(res.status).toBe(201);
    const { id: reportId } = await res.json<{ id: number }>();

    expect(
      (
        await api(
          `/api/v1/rooms/${id}/reports`,
          jsonRequest(
            "POST",
            { userId: reporter.id, reason: "spam" },
            reporter.cookie,
          ),
        )
      ).status,
    ).toBe(422);

    const admin = await signInAdmin();
    const overview = await api("/api/v1/admin/rooms", {
      headers: { cookie: admin.cookie },
    });
    expect(overview.status).toBe(200);
    const body = await overview.json<{
      reports: {
        id: number;
        message: string;
        banned: boolean;
        reported: { id: string };
      }[];
      usage: { voiceAvailable: boolean; enabled: boolean };
    }>();
    expect(body.usage).toMatchObject({ voiceAvailable: true, enabled: true });
    expect(body.reports.find((r) => r.id === reportId)).toMatchObject({
      message: "rude message",
      banned: false,
      reported: { id: reported.id },
    });

    const reportedConn = await connect(id, reported.cookie);
    await reportedConn.next("hello");
    const ban = await api(
      `/api/v1/admin/rooms/bans/${reported.id}`,
      jsonRequest("PUT", { reportId }, admin.cookie),
    );
    expect(ban.status).toBe(204);
    expect(await reportedConn.next("removed")).toEqual({
      t: "removed",
      ban: true,
    });
    const [report] = await db()
      .select()
      .from(roomReports)
      .where(eq(roomReports.id, reportId));
    expect(report!.status).toBe("resolved");

    const unban = await api(`/api/v1/admin/rooms/bans/${reported.id}`, {
      method: "DELETE",
      headers: { cookie: admin.cookie },
    });
    expect(unban.status).toBe(204);
    expect(
      await db()
        .select()
        .from(roomBans)
        .where(eq(roomBans.userId, reported.id)),
    ).toHaveLength(0);
  });

  it("is admins only", async () => {
    const student = await signIn();
    expect(
      (
        await api("/api/v1/admin/rooms", {
          headers: { cookie: student.cookie },
        })
      ).status,
    ).toBe(403);
  });
});
