import type { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../socket/index.js";

export type KlipServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

// Singleton — set once when registerSocketHandlers is called, read by route handlers
let _io: KlipServer | null = null;

export function setIo(io: KlipServer) {
  _io = io;
}

export function getIo(): KlipServer {
  if (!_io) throw new Error("Socket.io not initialized");
  return _io;
}

/** Emit to a room without throwing if Socket.io is not initialized or the emit fails.
 *  Use this in REST route handlers so a socket failure never breaks the HTTP response. */
export function tryEmit(
  room: string,
  event: keyof ServerToClientEvents,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
): void {
  try {
    if (!_io) return;
    _io.to(room).emit(event, data);
  } catch {
    // Non-fatal — the HTTP response already succeeded
  }
}
