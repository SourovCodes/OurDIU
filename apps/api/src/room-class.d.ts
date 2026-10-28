// The course rooms' Durable Object class, for ROOMS_DO in env.d.ts. The web
// project names the same class through its entry (apps/web/workers/room-class.d.ts).
// A global declaration file can't import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type CourseRoomClass = import("./services/rooms/course-room").CourseRoom;
