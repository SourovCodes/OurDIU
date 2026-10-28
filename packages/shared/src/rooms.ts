// Course rooms: live voice and chat for every course (docs/PLAN.md, decision 66).
// The limits and the WebSocket protocol between the browser (or app) and the
// course's room, a Durable Object. No Zod here, so the browser can import it
// (`@ourdiu/shared/rooms`); the server checks clients' messages with
// `roomClientMessageSchema` (schemas/rooms.ts).

/** People in one course's voice call. */
export const ROOM_VOICE_LIMIT = 50;
/** People unmuted at once in one call: cost grows with listeners × talkers. */
export const ROOM_TALKER_LIMIT = 10;
/** Open connections to one room (tabs on the course's pages). */
export const ROOM_SOCKET_LIMIT = 200;
export const ROOM_CHAT_MAX_LENGTH = 500;
/** Chat messages a connection may send per ROOM_CHAT_WINDOW_MS. */
export const ROOM_CHAT_BURST = 5;
export const ROOM_CHAT_WINDOW_MS = 10_000;

export const ROOM_REPORT_REASONS = [
  "harassment",
  "spam",
  "inappropriate",
  "other",
] as const;
export type RoomReportReason = (typeof ROOM_REPORT_REASONS)[number];
export const ROOM_REPORT_REASON_LABELS: Record<RoomReportReason, string> = {
  harassment: "Harassment or bullying",
  spam: "Spam",
  inappropriate: "Inappropriate content",
  other: "Something else",
};
export const ROOM_REPORT_STATUSES = [
  "pending",
  "resolved",
  "dismissed",
] as const;
export type RoomReportStatus = (typeof ROOM_REPORT_STATUSES)[number];

/** Someone as the room shows them. */
export type RoomPerson = { id: string; name: string; image: string | null };

/** Someone in the voice call. */
export type RoomVoiceMember = RoomPerson & {
  muted: boolean;
  /** Whether their microphone track is on the SFU yet (they can unmute). */
  live: boolean;
};

export type RoomState = {
  voice: RoomVoiceMember[];
  /** Different people connected to the room, in voice or not. */
  here: number;
  /** Whether voice calls work at all (the SFU is set up). */
  voiceAvailable: boolean;
  /** Paused for the rest of the usage cycle, or by an admin. */
  paused: { voice: boolean; chat: boolean };
  /** When a paused cycle ends (YYYY-MM-DD, UTC), for "paused until …". */
  pausedUntil: string | null;
};

export type RoomErrorCode =
  | "INVALID"
  | "VOICE_FULL"
  | "TALKERS_FULL"
  | "VOICE_PAUSED"
  | "CHAT_PAUSED"
  | "VOICE_UNAVAILABLE"
  | "NOT_IN_VOICE"
  | "TOO_FAST"
  | "FORBIDDEN"
  | "SFU_ERROR"
  // Sent just before a refused connection closes (ROOM_CLOSE).
  | "SIGNED_OUT"
  | "DIU_ONLY"
  | "BANNED"
  | "CLOSED"
  | "BUSY"
  | "NOT_FOUND";

/** What a client sends, as JSON text. The plain text "ping" gets "pong". */
export type RoomClientMessage =
  | { t: "chat"; text: string }
  | { t: "voice.join" }
  | { t: "voice.leave" }
  | { t: "voice.mute"; muted: boolean }
  /** The microphone's offer, from a peer connection with one sendonly audio m-line. */
  | { t: "sfu.push"; sdp: string; mid: string }
  /** Hear these people (their tracks are added to your session). */
  | { t: "sfu.pull"; userIds: string[] }
  /** Your answer to an `sfu.offer`. */
  | { t: "sfu.answer"; sdp: string }
  /** Admins only: take someone out of the room, and maybe out of every room. */
  | { t: "remove"; userId: string; ban: boolean };

export type RoomVoiceLeftReason = "left" | "moved" | "removed" | "paused";

/** What the room sends. */
export type RoomServerMessage =
  | ({ t: "state" } & RoomState)
  | { t: "hello"; me: RoomPerson & { admin: boolean } }
  | { t: "chat"; id: string; from: RoomPerson; text: string; at: number }
  | { t: "voice.joined"; sessionId: string }
  | { t: "voice.left"; reason: RoomVoiceLeftReason }
  | { t: "sfu.answer"; sdp: string }
  | { t: "sfu.offer"; sdp: string; tracks: { mid: string; userId: string }[] }
  | { t: "error"; code: RoomErrorCode; message: string }
  | { t: "removed"; ban: boolean };

/**
 * Why a room closed (or refused) a connection: a browser can't read a refused
 * upgrade's response, so the API accepts it, sends an `error` and closes with one
 * of these. Others (1006, 1011, …) are worth reconnecting after.
 */
export const ROOM_CLOSE = {
  SIGNED_OUT: 4001,
  DIU_ONLY: 4002,
  REMOVED: 4003,
  BANNED: 4004,
  CLOSED: 4005,
  BUSY: 4006,
  NOT_FOUND: 4007,
} as const;
export type RoomCloseCode = (typeof ROOM_CLOSE)[keyof typeof ROOM_CLOSE];
/** Close codes after which reconnecting won't help. */
export const ROOM_FINAL_CLOSES: readonly number[] = Object.values(ROOM_CLOSE);
