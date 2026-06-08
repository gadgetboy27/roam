import type { RequestHandler } from "express";
import type { Server as SocketServer } from "socket.io";

// Runtime dependencies created in registerRoutes() and passed to route modules
// that need them (rate limiters are express middleware; io is the socket server).
export interface RouteDeps {
  loginLimiter: RequestHandler;
  adminLoginLimiter: RequestHandler;
  profileLimiter: RequestHandler;
  verifyLimiter: RequestHandler;
  uploadLimiter: RequestHandler;
  checkoutLimiter: RequestHandler;
  io: SocketServer;
}
