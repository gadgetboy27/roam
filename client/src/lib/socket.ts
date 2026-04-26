import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;
let currentToken: string | null = null;

export function initSocket(token?: string): Socket {
  if (socket && currentToken === (token ?? null)) return socket;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  currentToken = token ?? null;
  socket = io({
    path: "/socket.io",
    auth: token ? { token } : undefined,
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
    transports: ["websocket", "polling"],
  });
  return socket;
}

export function getSocket(): Socket {
  if (!socket) socket = initSocket();
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
}
