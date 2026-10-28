import type { RoomCloseCode, RoomErrorCode } from "@ourdiu/shared/rooms";

/**
 * Refuses a WebSocket in a way a browser can read: accept it, say why, close it
 * with a code from ROOM_CLOSE (a refused upgrade only shows the browser 1006).
 */
export function refuseSocket(
  code: RoomErrorCode,
  close: RoomCloseCode,
  message: string,
) {
  const { 0: client, 1: server } = new WebSocketPair();
  server.accept();
  server.send(JSON.stringify({ t: "error", code, message }));
  server.close(close, code);
  return new Response(null, { status: 101, webSocket: client });
}
