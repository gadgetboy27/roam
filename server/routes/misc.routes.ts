import type { Express } from "express";
import { storage } from "../storage";
import { pool } from "../db";
import { isAdminAuthenticated } from "../admin-auth";

// Notifications (list / unread-count / mark-read) and user feedback.
export function registerMiscRoutes(app: Express) {
  // ─── Notifications ────────────────────────────────────────────────────────

  app.get("/api/notifications", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const items = await storage.getNotificationsForUser(userId, 30);
    res.json(items);
  });

  app.get("/api/notifications/unread-count", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const count = await storage.getUnreadNotificationCount(userId);
    res.json({ count });
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const notification = await storage.getNotificationById(Number(req.params.id));
    if (!notification) return res.status(404).json({ error: "Notification not found" });
    if (notification.userId !== userId) return res.status(403).json({ error: "Not authorized" });
    await storage.markNotificationRead(Number(req.params.id));
    res.json({ success: true });
  });

  app.patch("/api/notifications/read-all", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    await storage.markAllNotificationsRead(userId);
    res.json({ success: true });
  });

  // ─── Feedback ──────────────────────────────────────────────────────────────

  app.post("/api/feedback", async (req, res) => {
    try {
      const userId = req.session?.userId;
      const { message, page } = req.body;
      if (!message?.trim()) return res.status(400).json({ message: "Message is required" });
      let userName: string | null = null;
      let userEmail: string | null = null;
      if (userId) {
        const u = await storage.getUser(userId);
        if (u) { userName = u.name; userEmail = u.email; }
      }
      await pool.query(
        "INSERT INTO feedback (user_id, user_name, user_email, message, page) VALUES ($1,$2,$3,$4,$5)",
        [userId || null, userName, userEmail, message.trim(), page || null]
      );
      console.log(`[feedback] feedback submitted`);

      // ── Email notification to admin ──────────────────────────────────────
      const adminEmails = process.env.ADMIN_EMAILS;
      const resendKey  = process.env.RESEND_API_KEY;
      if (adminEmails && resendKey) {
        const recipients = adminEmails.split(",").map((e: string) => e.trim()).filter(Boolean);
        const senderLabel = userName ? `${userName}${userEmail ? ` <${userEmail}>` : ""}` : (userEmail || "Anonymous user");
        const pageLabel   = page ? ` on <strong>${page}</strong>` : "";
        const emailBody   = `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
            <h2 style="color:#1a1a1a;margin-bottom:4px">New roam. feedback</h2>
            <p style="color:#666;font-size:13px;margin-top:0">From ${senderLabel}${pageLabel}</p>
            <div style="background:#f5f5f5;border-radius:8px;padding:16px 20px;margin:16px 0;white-space:pre-wrap;font-size:15px;color:#222">${message.trim()}</div>
            <p style="color:#999;font-size:12px">View all feedback in the <a href="https://letsroam.life/admin" style="color:#7ecb35">admin dashboard → Feedback tab</a></p>
          </div>`;
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "LetsRoam.life <noreply@letsroam.life>",
            to: recipients,
            subject: `💬 New feedback from ${userName || userEmail || "a roamer"}`,
            html: emailBody,
          }),
        }).catch((e: Error) => console.warn("[feedback-email] send failed:", e.message));
      }

      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/feedback", async (req, res) => {
    if (!(await isAdminAuthenticated(req))) return res.status(401).json({ message: "Admin authentication required" });
    try {
      const { rows } = await pool.query("SELECT * FROM feedback ORDER BY created_at DESC LIMIT 200");
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
