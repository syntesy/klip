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
