import type { Express } from "express";
import { storage } from "../storage";
import { pool } from "../db";
import { isAdminAuthenticated } from "../admin-auth";
import { authenticateRequest } from "../http-helpers";
import { brandedEmail, emailParagraph, sendEmail } from "../email";

// Notifications (list / unread-count / mark-read) and user feedback.
export function registerMiscRoutes(app: Express) {
  // ─── Notifications ────────────────────────────────────────────────────────

  app.get("/api/notifications", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const items = await storage.getNotificationsForUser(userId, 30);
    res.json(items);
  });

  app.get("/api/notifications/unread-count", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const count = await storage.getUnreadNotificationCount(userId);
    res.json({ count });
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const notification = await storage.getNotificationById(Number(req.params.id));
    if (!notification) return res.status(404).json({ error: "Notification not found" });
    if (notification.userId !== userId) return res.status(403).json({ error: "Not authorized" });
    await storage.markNotificationRead(Number(req.params.id));
    res.json({ success: true });
  });

  app.patch("/api/notifications/read-all", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    await storage.markAllNotificationsRead(userId);
    res.json({ success: true });
  });

  // ─── Feedback ──────────────────────────────────────────────────────────────

  app.post("/api/feedback", async (req, res) => {
    try {
      const userId = await authenticateRequest(req);
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

      // ── Email notification to admin (branded template) ───────────────────
      const adminEmails = process.env.ADMIN_EMAILS;
      if (adminEmails) {
        const recipients = adminEmails.split(",").map((e: string) => e.trim()).filter(Boolean);
        const senderLabel = userName ? `${userName}${userEmail ? ` &lt;${userEmail}&gt;` : ""}` : (userEmail || "Anonymous user");
        const pageLabel   = page ? ` on <b style="color:#f2ede3;">${page}</b>` : "";
        void sendEmail({
          to: recipients,
          subject: `💬 New feedback from ${userName || userEmail || "a roamer"}`,
          html: brandedEmail({
            bodyHtml:
              emailParagraph(`New feedback from <b style="color:#f2ede3;">${senderLabel}</b>${pageLabel}`)
              + `<div style="background:rgba(242,237,227,0.05);border:1px solid rgba(242,237,227,0.08);border-radius:12px;padding:14px 18px;margin:12px 0 0;white-space:pre-wrap;font-size:14px;color:#f2ede3;line-height:1.6;">${message.trim()}</div>`,
            ctaText: "Open admin dashboard →",
            ctaUrl: "https://letsroam.life/admin",
            footerNote: "Admin notification — sent to your ADMIN_EMAILS.",
          }),
        });
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
