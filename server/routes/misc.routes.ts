import type { Express } from "express";
import { storage } from "../storage";
import { pool } from "../db";
import { isAdminAuthenticated } from "../admin-auth";
import { authenticateRequest } from "../http-helpers";
import { brandedEmail, emailParagraph, sendEmail } from "../email";
import type { RouteDeps } from "./deps";

const MAX_FEEDBACK_LEN = 4000;

// Escape user-supplied text before embedding in the HTML email so a message
// can never inject markup (defence against stored-XSS / email spoofing).
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
  ));
}

// Notifications (list / unread-count / mark-read) and user feedback.
export function registerMiscRoutes(app: Express, deps: RouteDeps) {
  const { feedbackLimiter } = deps;
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

  // ─── Boost feedback (one-tap 👍/👎 from the post-boost notification) ────────
  // Stored in the same feedback table so it surfaces in the admin feedback view
  // alongside written feedback — the keep/tune/kill signal for the Boost feature.
  app.post("/api/boost/feedback", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Please sign in." });
    const worked = req.body?.worked === true;
    const u = await storage.getUser(userId);
    await pool.query(
      "INSERT INTO feedback (user_id, user_name, user_email, message, page) VALUES ($1,$2,$3,$4,$5)",
      [userId, u?.name ?? null, u?.email ?? null,
       `Boost feedback: ${worked ? "👍 worked — more matches" : "👎 didn't help"}`, "boost"],
    );
    // Mark the prompting notification read so it stops nagging.
    const notifId = Number(req.body?.notificationId);
    if (notifId) {
      const n = await storage.getNotificationById(notifId);
      if (n && n.userId === userId) await storage.markNotificationRead(notifId);
    }
    console.log(`[boost-feedback] user ${userId}: ${worked ? "worked" : "didn't"}`);
    res.json({ ok: true });
  });

  // ─── Feedback ──────────────────────────────────────────────────────────────

  app.post("/api/feedback", feedbackLimiter, async (req, res) => {
    try {
      // Honeypot: a hidden field real users never fill. Bots auto-fill every
      // field, so a non-empty value means it's a bot — silently accept (so the
      // bot can't tell it was blocked) but store/send nothing.
      if (typeof req.body?.company === "string" && req.body.company.trim()) {
        return res.json({ ok: true });
      }

      // Auth required: guarantees we always have a real name + email to reply
      // to, and blocks drive-by bots that POST without a logged-in session.
      const userId = await authenticateRequest(req);
      if (!userId) return res.status(401).json({ message: "Please sign in to send feedback." });

      const { page } = req.body;
      const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
      if (!message) return res.status(400).json({ message: "Message is required" });
      if (message.length > MAX_FEEDBACK_LEN) {
        return res.status(400).json({ message: `Please keep feedback under ${MAX_FEEDBACK_LEN} characters.` });
      }

      const u = await storage.getUser(userId);
      const userName: string | null = u?.name ?? null;
      const userEmail: string | null = u?.email ?? null;

      await pool.query(
        "INSERT INTO feedback (user_id, user_name, user_email, message, page) VALUES ($1,$2,$3,$4,$5)",
        [userId, userName, userEmail, message, page || null]
      );
      console.log(`[feedback] submitted by user ${userId}`);

      // ── Email notification to admin (branded template) ───────────────────
      const adminEmails = process.env.ADMIN_EMAILS;
      if (adminEmails) {
        const recipients = adminEmails.split(",").map((e: string) => e.trim()).filter(Boolean);
        const safeName  = userName ? escapeHtml(userName) : "A roamer";
        const safeEmail = userEmail ? escapeHtml(userEmail) : null;
        const senderLabel = safeEmail ? `${safeName} &lt;${safeEmail}&gt;` : safeName;
        const pageLabel = page ? ` on <b style="color:#f2ede3;">${escapeHtml(String(page))}</b>` : "";
        const replyNote = safeEmail
          ? emailParagraph(`Just hit <b style="color:#f2ede3;">Reply</b> to respond to ${safeName} directly (${safeEmail}).`)
          : "";
        void sendEmail({
          to: recipients,
          replyTo: userEmail || undefined,
          subject: `💬 New feedback from ${userName || "a roamer"}`,
          html: brandedEmail({
            bodyHtml:
              emailParagraph(`New feedback from <b style="color:#f2ede3;">${senderLabel}</b>${pageLabel}`)
              + `<div style="background:rgba(242,237,227,0.05);border:1px solid rgba(242,237,227,0.08);border-radius:12px;padding:14px 18px;margin:12px 0 0;white-space:pre-wrap;font-size:14px;color:#f2ede3;line-height:1.6;">${escapeHtml(message)}</div>`
              + replyNote,
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
