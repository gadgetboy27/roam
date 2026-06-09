import type { Express } from "express";
import { storage } from "../storage";
import { pool } from "../db";

// Safety mode, blocking, reporting, and safety contacts / check-ins / SOS alerts.
export function registerSafetyRoutes(app: Express) {
  // ─── Safety mode toggle ───────────────────────────────────────────────────

  app.patch("/api/users/:id/safety-mode", async (req, res) => {
    const sessionUserId = req.session?.userId;
    if (!sessionUserId || sessionUserId !== req.params.id) return res.status(401).json({ error: "Unauthorised" });
    const { safetyModeEnabled } = req.body;
    const updated = await storage.updateUser(req.params.id, { safetyModeEnabled: !!safetyModeEnabled });
    res.json({ safetyModeEnabled: updated?.safetyModeEnabled });
  });

  // ─── Block a user ─────────────────────────────────────────────────────────

  app.post("/api/users/:id/block", async (req, res) => {
    const sessionUserId = req.session?.userId;
    if (!sessionUserId) return res.status(401).json({ error: "Unauthorised" });
    if (sessionUserId === req.params.id) return res.status(400).json({ error: "Cannot block yourself" });
    try {
      await pool.query(
        `INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [sessionUserId, req.params.id]
      );
      res.json({ blocked: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/users/:id/block", async (req, res) => {
    const sessionUserId = req.session?.userId;
    if (!sessionUserId) return res.status(401).json({ error: "Unauthorised" });
    try {
      await pool.query(
        `DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`,
        [sessionUserId, req.params.id]
      );
      res.json({ blocked: false });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/me/blocks", async (req, res) => {
    const sessionUserId = req.session?.userId;
    if (!sessionUserId) return res.status(401).json({ error: "Unauthorised" });
    try {
      const { rows } = await pool.query(
        `SELECT blocked_id FROM blocks WHERE blocker_id = $1`,
        [sessionUserId]
      );
      res.json(rows.map((r: any) => r.blocked_id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Report a user ────────────────────────────────────────────────────────

  app.post("/api/users/:id/report", async (req, res) => {
    const sessionUserId = req.session?.userId;
    if (!sessionUserId) return res.status(401).json({ error: "Unauthorised" });
    if (sessionUserId === req.params.id) return res.status(400).json({ error: "Cannot report yourself" });
    const { reason, detail } = req.body;
    if (!reason) return res.status(400).json({ error: "Reason required" });
    try {
      await pool.query(
        `INSERT INTO reports (reporter_id, reported_id, reason, detail) VALUES ($1, $2, $3, $4)`,
        [sessionUserId, req.params.id, reason, detail || null]
      );
      console.log(`[safety] Report filed: user ${sessionUserId} reported ${req.params.id} for "${reason}"`);
      res.json({ reported: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Safety: contacts, check-ins, SOS alert ──────────────────────────────

  app.get("/api/safety/contacts", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    try {
      const { rows } = await pool.query(
        `SELECT sc.contact_user_id as id, u.name, u.avatar_url, u.identity_verified
         FROM safety_contacts sc
         JOIN users u ON u.id = sc.contact_user_id
         WHERE sc.user_id = $1
         ORDER BY sc.created_at DESC`,
        [userId]
      );
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/safety/eligible-contacts", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    try {
      const { rows } = await pool.query(
        `SELECT DISTINCT u.id, u.name, u.avatar_url, u.identity_verified
         FROM users u
         WHERE u.id != $1
           AND (
             EXISTS (
               SELECT 1 FROM matches m WHERE m.status = 'matched'
               AND ((m.user_a_id = $1 AND m.user_b_id = u.id) OR (m.user_b_id = $1 AND m.user_a_id = u.id))
             ) OR
             EXISTS (
               SELECT 1 FROM group_members gm1
               JOIN group_members gm2 ON gm1.group_id = gm2.group_id
               WHERE gm1.user_id = $1 AND gm2.user_id = u.id
                 AND gm1.status = 'approved' AND gm2.status = 'approved'
             )
           )
           AND NOT EXISTS (SELECT 1 FROM safety_contacts sc WHERE sc.user_id = $1 AND sc.contact_user_id = u.id)
         ORDER BY u.name LIMIT 50`,
        [userId]
      );
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/safety/contacts/:contactId", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const { contactId } = req.params;
    if (contactId === userId) return res.status(400).json({ error: "Cannot add yourself" });
    try {
      const { rows: u } = await pool.query("SELECT id FROM users WHERE id = $1", [contactId]);
      if (!u.length) { return res.status(404).json({ error: "User not found" }); }
      await pool.query(
        `INSERT INTO safety_contacts (user_id, contact_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, contactId]
      );
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/safety/contacts/:contactId", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    try {
      await pool.query("DELETE FROM safety_contacts WHERE user_id = $1 AND contact_user_id = $2", [userId, req.params.contactId]);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/safety/checkins", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    try {
      const { rows } = await pool.query(
        `SELECT * FROM safety_checkins WHERE user_id = $1 ORDER BY scheduled_at DESC LIMIT 20`,
        [userId]
      );
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/safety/checkin", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const { scheduledAt, place, meetingWith } = req.body;
    if (!scheduledAt) return res.status(400).json({ error: "scheduledAt required" });
    const scheduled = new Date(scheduledAt);
    if (isNaN(scheduled.getTime()) || scheduled <= new Date()) {
      return res.status(400).json({ error: "scheduledAt must be in the future" });
    }
    try {
      const { rows } = await pool.query(
        `INSERT INTO safety_checkins (user_id, scheduled_at, place, meeting_with) VALUES ($1,$2,$3,$4) RETURNING *`,
        [userId, scheduled.toISOString(), place || null, meetingWith || null]
      );
      res.json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/safety/checkin/:id/confirm", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    try {
      const { rows } = await pool.query(
        `UPDATE safety_checkins SET confirmed_at = now()
         WHERE id = $1 AND user_id = $2 AND confirmed_at IS NULL AND cancelled_at IS NULL RETURNING *`,
        [req.params.id, userId]
      );
      if (!rows.length) return res.status(404).json({ error: "Check-in not found or already confirmed" });
      res.json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/safety/checkin/:id", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    try {
      await pool.query(
        `UPDATE safety_checkins SET cancelled_at = now() WHERE id = $1 AND user_id = $2`,
        [req.params.id, userId]
      );
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/safety/alert", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const { place } = req.body;
    try {
      const [userRes, contactsRes] = await Promise.all([
        pool.query("SELECT name FROM users WHERE id = $1", [userId]),
        pool.query("SELECT contact_user_id FROM safety_contacts WHERE user_id = $1", [userId]),
      ]);
      const userName = userRes.rows[0]?.name || "A roam member";
      const contacts: string[] = contactsRes.rows.map((r: any) => r.contact_user_id);
      const triggeredAt = new Date().toISOString();
      for (const contactId of contacts) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, body, data) VALUES ($1,$2,$3,$4,$5)`,
          [
            contactId, "safety_sos", "SOS — Safety Alert",
            `${userName} has triggered a safety alert${place ? ` from ${place}` : ""}. Please check on them immediately.`,
            JSON.stringify({ reportingUserId: userId, place: place || null, triggeredAt }),
          ]
        );
      }
      if (contacts.length > 0) {
        await pool.query(
          `INSERT INTO safety_alert_log (user_id, type, place, contacts_notified) VALUES ($1,'sos',$2,$3)`,
          [userId, place || null, contacts]
        );
      }
      console.log(`[safety] SOS fired by ${userId}, ${contacts.length} contacts alerted`);
      res.json({ ok: true, contactsAlerted: contacts.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
}
