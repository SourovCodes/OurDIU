import { z } from "zod";
import { adminUserRefSchema } from "./admin";
import {
  ROOM_CHAT_MAX_LENGTH,
  ROOM_REPORT_REASONS,
  ROOM_REPORT_STATUSES,
  ROOM_VOICE_LIMIT,
} from "../rooms";

const sdp = z.string().min(1).max(20_000);

/** A client's message to its room (`RoomClientMessage`), checked by the room. */
export const roomClientMessageSchema = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("chat"),
    text: z.string().max(ROOM_CHAT_MAX_LENGTH * 2),
  }),
  z.object({ t: z.literal("voice.join") }),
  z.object({ t: z.literal("voice.leave") }),
  z.object({ t: z.literal("voice.mute"), muted: z.boolean() }),
  z.object({ t: z.literal("sfu.push"), sdp, mid: z.string().min(1).max(32) }),
  z.object({
    t: z.literal("sfu.pull"),
    userIds: z.array(z.string().min(1).max(64)).min(1).max(ROOM_VOICE_LIMIT),
  }),
  z.object({ t: z.literal("sfu.answer"), sdp }),
  z.object({
    t: z.literal("remove"),
    userId: z.string().min(1).max(64),
    ban: z.boolean(),
  }),
]);

/** Who's in a course's room, for anyone (no names). */
export const roomSummarySchema = z
  .object({
    voice: z.number().int(),
    talking: z.number().int(),
    here: z.number().int(),
  })
  .meta({ id: "RoomSummary" });
export type RoomSummary = z.infer<typeof roomSummarySchema>;

export const roomReportReasonSchema = z
  .enum(ROOM_REPORT_REASONS)
  .meta({ id: "RoomReportReason" });
export const roomReportStatusSchema = z
  .enum(ROOM_REPORT_STATUSES)
  .meta({ id: "RoomReportStatus" });

export const createRoomReportInputSchema = z
  .object({
    userId: z.string().min(1).max(64),
    reason: roomReportReasonSchema,
    /** The message reported, as the reporter saw it (chat isn't stored). */
    message: z.string().trim().min(1).max(ROOM_CHAT_MAX_LENGTH).optional(),
  })
  .meta({ id: "CreateRoomReportInput" });
export type CreateRoomReportInput = z.infer<typeof createRoomReportInputSchema>;

// ── Admin ────────────────────────────────────────────────────────────────────

/** This usage cycle's estimated use of the free allowances, and the pause. */
export const adminRoomUsageSchema = z.object({
  /** First day of the cycle (YYYY-MM-DD, UTC); the next one starts on `resetsOn`. */
  cycle: z.iso.date(),
  resetsOn: z.iso.date(),
  voiceBytes: z.number().int(),
  voiceSeconds: z.number().int(),
  messages: z.number().int(),
  voiceBytesCap: z.number().int(),
  messagesCap: z.number().int(),
  /** Paused by an admin (`PUT /admin/rooms/settings`). */
  paused: z.boolean(),
  /** Off in the Worker's config (`ROOMS`), or voice not set up (no SFU app). */
  enabled: z.boolean(),
  voiceAvailable: z.boolean(),
});
export type AdminRoomUsage = z.infer<typeof adminRoomUsageSchema>;

export const adminRoomReportSchema = z.object({
  id: z.number().int(),
  course: z.object({ id: z.number().int(), name: z.string() }),
  reporter: adminUserRefSchema,
  reported: adminUserRefSchema,
  reason: roomReportReasonSchema,
  message: z.string().nullable(),
  status: roomReportStatusSchema,
  /** Whether the reported person is banned from rooms now. */
  banned: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type AdminRoomReport = z.infer<typeof adminRoomReportSchema>;

export const adminRoomBanSchema = z.object({
  user: adminUserRefSchema,
  createdAt: z.iso.datetime(),
});
export type AdminRoomBan = z.infer<typeof adminRoomBanSchema>;

export const adminRoomsSchema = z.object({
  usage: adminRoomUsageSchema,
  reports: z.array(adminRoomReportSchema),
  bans: z.array(adminRoomBanSchema),
});
export type AdminRooms = z.infer<typeof adminRoomsSchema>;

export const roomSettingsInputSchema = z.object({ paused: z.boolean() });
export const updateRoomReportInputSchema = z.object({
  status: z.enum(["resolved", "dismissed"]),
});

export const createdRoomReportSchema = z
  .object({ id: z.number().int() })
  .meta({ id: "CreatedRoomReport" });
