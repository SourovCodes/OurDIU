import type { RoomPerson } from "@ourdiu/shared/rooms";

// Apart from course-room.ts, which imports `cloudflare:workers`, so the routes (and
// the OpenAPI export, which runs in Node) don't load it.

/** The header the API sets with the signed-in person (never from the client). */
export const ROOM_USER_HEADER = "x-room-user";
export type RoomUser = RoomPerson & { admin: boolean };
