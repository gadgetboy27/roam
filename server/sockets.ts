import type { Server as SocketServer } from "socket.io";
import { storage } from "./storage";
import { supabaseAdmin } from "./supabaseAdmin";
import { notifyNewMessage, notifyGroupMessage } from "./http-helpers";

// Attaches all Socket.io connection auth + handlers to an existing io instance.
// io is created in registerRoutes (it's also used by REST routes), so we only
// register the behaviour here.
export function setupSockets(io: SocketServer) {
  // Verify Supabase token on socket connection — attach verified userId to socket.data
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        if (!error && user?.email) {
          const dbUser = await storage.getUserByEmail(user.email);
          if (dbUser) {
            socket.data.userId = dbUser.id;
            return next();
          }
        }
      } catch { /* fall through */ }
    }
    // Allow unauthenticated connections for connection-status monitoring
    // but mark userId as null — authenticated handlers will reject if null
    socket.data.userId = null;
    next();
  });

  io.on("connection", (socket) => {
    socket.on("join_match", (matchId: string) => {
      if (!socket.data.userId) return;
      socket.join(`match:${matchId}`);
    });

    socket.on("send_message", async (data: { matchId: string; content: string; tempId?: string }) => {
      const senderId = socket.data.userId;
      if (!senderId) {
        socket.emit("message_error", { tempId: data.tempId, error: "Authentication required" });
        return;
      }
      try {
        const match = await storage.getMatchById(data.matchId);
        if (!match || match.status !== "matched") {
          socket.emit("message_error", { tempId: data.tempId, error: "Messaging requires a mutual match" });
          return;
        }
        if (match.userAId !== senderId && match.userBId !== senderId) {
          socket.emit("message_error", { tempId: data.tempId, error: "Not a participant in this match" });
          return;
        }
        const msg = await storage.createMessage({ matchId: data.matchId, senderId, content: data.content });
        io.to(`match:${data.matchId}`).emit("new_message", { ...msg, tempId: data.tempId });
        // Alert the recipient via the notification bell even if they don't have
        // this chat open. Deduped: one unread "message" notification per match.
        notifyNewMessage(match, senderId, data.content).catch(() => {});
      } catch (err: any) {
        socket.emit("message_error", { tempId: data.tempId, error: err.message });
      }
    });
  });

  // ─── Extend Socket.io for group campsite chat ─────────────────────────────
  io.on("connection", (socket) => {
    socket.on("join_group", async (groupId: string) => {
      if (!socket.data.userId) return;
      const member = await storage.getGroupMember(groupId, socket.data.userId);
      if (!member || member.status !== "approved") return;
      socket.join(`group:${groupId}`);
    });

    socket.on("leave_group", (groupId: string) => {
      socket.leave(`group:${groupId}`);
    });

    socket.on("send_group_message", async (data: { groupId: string; content: string; tempId?: string }) => {
      const senderId = socket.data.userId;
      if (!senderId) {
        socket.emit("group_message_error", { tempId: data.tempId, error: "Authentication required" });
        return;
      }
      if (!data.content || data.content.length > 2000) {
        socket.emit("group_message_error", { tempId: data.tempId, error: "Message must be 1–2000 characters" });
        return;
      }
      try {
        // Check membership using the verified server-side senderId
        const member = await storage.getGroupMember(data.groupId, senderId);
        if (!member || member.status !== "approved") {
          socket.emit("group_message_error", { tempId: data.tempId, error: "Not an approved member of this group" });
          return;
        }
        const [msg, sender] = await Promise.all([
          storage.createGroupMessage({ groupId: data.groupId, senderId, content: data.content }),
          storage.getUser(senderId),
        ]);
        io.to(`group:${data.groupId}`).emit("new_group_message", {
          ...msg,
          sender: sender ? { id: sender.id, name: sender.nickname || sender.name, avatarUrl: sender.avatarUrl } : null,
          tempId: data.tempId,
        });
        // Alert other approved members via the bell even if they aren't in the
        // group chat. Deduped: one unread notification per member per group.
        notifyGroupMessage(data.groupId, senderId, sender?.name ?? "Someone", data.content).catch(() => {});
      } catch (err: any) {
        socket.emit("group_message_error", { tempId: data.tempId, error: err.message });
      }
    });
  });
}
