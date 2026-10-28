import { eq, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { roomSettings, roomUsage } from "../../db/schema";

/**
 * Bytes the SFU sends for one listener hearing one talker for a second: Opus at
 * 32 kbps (4,000 B/s) plus RTP, UDP and IP headers at 50 packets a second, rounded
 * up so the estimate errs high.
 */
export const BYTES_PER_STREAM_SECOND = 6_500;

const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(y, m, d));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

/**
 * The usage cycle `now` falls in: from `cycleDay` of one month (UTC) to the same
 * day of the next, like the account's billing period (`ROOMS_CYCLE_DAY`).
 */
export function usageCycle(now: Date, cycleDay: number) {
  const day = Math.min(28, Math.max(1, Math.trunc(cycleDay) || 1));
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() - (now.getUTCDate() < day ? 1 : 0);
  return { start: isoDay(y, m, day), next: isoDay(y, m + 1, day) };
}

export type RoomLimits = {
  enabled: boolean;
  voiceAvailable: boolean;
  voiceBytesCap: number;
  messagesCap: number;
  cycleDay: number;
};

export function roomLimits(env: Env): RoomLimits {
  return {
    enabled: env.ROOMS === "on",
    voiceAvailable: !!env.REALTIME_APP_ID && !!env.REALTIME_APP_TOKEN,
    voiceBytesCap: Math.round(Number(env.ROOMS_VOICE_MONTHLY_GB || 0) * 1e9),
    messagesCap: Math.round(Number(env.ROOMS_MONTHLY_MESSAGES || 0)),
    cycleDay: Number(env.ROOMS_CYCLE_DAY || 1),
  };
}

export type UsageDelta = {
  voiceBytes: number;
  voiceSeconds: number;
  messages: number;
};

/** Adds a room's usage since its last flush to its cycle's totals. */
export async function addUsage(db: Database, cycle: string, delta: UsageDelta) {
  const values = {
    voiceBytes: Math.round(delta.voiceBytes),
    voiceSeconds: Math.round(delta.voiceSeconds),
    messages: Math.round(delta.messages),
  };
  if (!values.voiceBytes && !values.voiceSeconds && !values.messages) return;
  await db
    .insert(roomUsage)
    .values({ cycle, ...values })
    .onConflictDoUpdate({
      target: roomUsage.cycle,
      set: {
        voiceBytes: sql`${roomUsage.voiceBytes} + ${values.voiceBytes}`,
        voiceSeconds: sql`${roomUsage.voiceSeconds} + ${values.voiceSeconds}`,
        messages: sql`${roomUsage.messages} + ${values.messages}`,
        updatedAt: new Date(),
      },
    });
}

export async function readUsage(db: Database, cycle: string) {
  const [row] = await db
    .select()
    .from(roomUsage)
    .where(eq(roomUsage.cycle, cycle));
  return {
    voiceBytes: row?.voiceBytes ?? 0,
    voiceSeconds: row?.voiceSeconds ?? 0,
    messages: row?.messages ?? 0,
  };
}

export async function roomsPausedByAdmin(db: Database) {
  const [row] = await db
    .select({ paused: roomSettings.paused })
    .from(roomSettings)
    .where(eq(roomSettings.id, 1));
  return row?.paused ?? false;
}

export async function setRoomsPaused(db: Database, paused: boolean) {
  await db
    .insert(roomSettings)
    .values({ id: 1, paused })
    .onConflictDoUpdate({
      target: roomSettings.id,
      set: { paused, updatedAt: new Date() },
    });
}

export type RoomPause = {
  voice: boolean;
  chat: boolean;
  cycle: string;
  /** When the cycle ends, if anything is paused only for it. */
  until: string | null;
};

/** What's paused now: everything when off or paused by an admin, else per cap. */
export async function roomPause(
  db: Database,
  limits: RoomLimits,
  now = new Date(),
): Promise<RoomPause> {
  const { start, next } = usageCycle(now, limits.cycleDay);
  const [usage, byAdmin] = await Promise.all([
    readUsage(db, start),
    roomsPausedByAdmin(db),
  ]);
  if (!limits.enabled || byAdmin) {
    return { voice: true, chat: true, cycle: start, until: null };
  }
  const voice = usage.voiceBytes >= limits.voiceBytesCap;
  const chat = usage.messages >= limits.messagesCap;
  return { voice, chat, cycle: start, until: voice || chat ? next : null };
}
