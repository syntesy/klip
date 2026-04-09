import type { Server } from "socket.io";

// Singleton — set once when registerSocketHandlers is called, read by route handlers
let _io: Server | null = null;

export function setIo(io: Server) {
  _io = io;
}

export function getIo(): Server {
  if (!_io) throw new Error("Socket.io not initialized");
  return _io;
}
