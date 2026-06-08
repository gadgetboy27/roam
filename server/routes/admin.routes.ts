import type { Express } from "express";
import { storage } from "../storage";
import { supabaseAdmin } from "../supabaseAdmin";
import { compareAdminPassword, hashAdminPassword, isAdminAuthenticated, getAdminFromSession } from "../admin-auth";
import { AD_TIERS } from "../http-helpers";
import type { RouteDeps } from "./deps";

// Admin console: auth, admin accounts, user/group moderation, ad review, audit log.
export function registerAdminRoutes(app: Express, deps: RouteDeps) {
  const { adminLoginLimiter } = deps;
  // ─── Admin auth ──────────────────────────────────────────────────────────

  app.post("/api/admin/auth/login", adminLoginLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }
    const admin = await storage.getAdminByUsername(username.trim().toLowerCase());
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const valid = await compareAdminPassword(password, admin.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    (req.session as any).adminId = admin.id;
    console.log(`[admin] Login: ${admin.username}`);
    return res.json({ id: admin.id, username: admin.username, displayName: admin.displayName });
  });

  app.post("/api/admin/auth/logout", (req, res) => {
    (req.session as any).adminId = null;
    return res.json({ ok: true });
  });

  app.get("/api/admin/auth/me", async (req, res) => {
    const adminId = await getAdminFromSession(req);
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const admin = await storage.getAdminById(adminId);
    if (!admin) return res.status(401).json({ message: "Admin not found" });
    return res.json({ id: admin.id, username: admin.username, displayName: admin.displayName });
  });

  app.get("/api/admin/accounts", async (req, res) => {
    if (!(await isAdminAuthenticated(req))) {
      return res.status(401).json({ message: "Admin authentication required" });
    }
    const admins = await storage.getAllAdmins();
    return res.json(admins.map(({ passwordHash: _, ...a }) => a));
  });

  app.post("/api/admin/accounts", async (req, res) => {
    const adminId = await getAdminFromSession(req);
    if (!(await isAdminAuthenticated(req))) {
      return res.status(401).json({ message: "Admin authentication required" });
    }
    const { username, password, displayName } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }
    if (password.length < 12) {
      return res.status(400).json({ message: "Password must be at least 12 characters" });
    }
    const existing = await storage.getAdminByUsername(username.trim().toLowerCase());
    if (existing) return res.status(409).json({ message: "Username already taken" });
    const passwordHash = await hashAdminPassword(password);
    const newAdmin = await storage.createAdmin({
      username: username.trim().toLowerCase(),
      passwordHash,
      displayName: displayName?.trim() || username.trim(),
      createdBy: adminId || undefined,
    });
    const creator = adminId ? await storage.getAdminById(adminId) : null;
    console.log(`[admin] New admin created: "${newAdmin.username}" by "${creator?.username ?? "unknown"}"`);
    return res.status(201).json({ id: newAdmin.id, username: newAdmin.username, displayName: newAdmin.displayName });
  });

  app.delete("/api/admin/accounts/:id", async (req, res) => {
    const adminId = await getAdminFromSession(req);
    if (!(await isAdminAuthenticated(req))) {
      return res.status(401).json({ message: "Admin authentication required" });
    }
    if (req.params.id === adminId) {
      return res.status(400).json({ message: "Cannot delete your own admin account" });
    }
    const total = await storage.getAdminCount();
    if (total <= 1) {
      return res.status(400).json({ message: "Cannot delete the last admin account" });
    }
    const target = await storage.getAdminById(req.params.id);
    if (!target) return res.status(404).json({ message: "Admin not found" });
    await storage.deleteAdmin(req.params.id);
    console.log(`[admin] Admin account "${target.username}" deleted`);
    return res.json({ ok: true });
  });
  app.get("/api/admin/users", async (req, res) => {
    if (!(await isAdminAuthenticated(req))) {
      return res.status(401).json({ message: "Admin authentication required" });
    }
    const allUsers = await storage.getAllUsers();
    return res.json(allUsers.map(({ password: _, ...u }) => u));
  });

  app.patch("/api/admin/users/:id", async (req, res) => {
    if (!(await isAdminAuthenticated(req))) {
      return res.status(401).json({ message: "Admin authentication required" });
    }
    const adminId = await getAdminFromSession(req);
    const { tier, isTierGifted } = req.body;
    if (tier && !["free", "adventurer", "contributor"].includes(tier)) {
      return res.status(400).json({ message: "Invalid tier" });
    }
    const updateData: Record<string, any> = {};
    if (tier !== undefined) updateData.tier = tier;
    if (isTierGifted !== undefined) {
      updateData.isTierGifted = isTierGifted;
      if (isTierGifted) updateData.tier = "adventurer";
      else {
        const current = await storage.getUser(req.params.id);
        if (current && !current.isFoundingMember) updateData.tier = "free";
      }
    }
    const updated = await storage.updateUser(req.params.id, updateData);
    if (!updated) return res.status(404).json({ message: "User not found" });
    const { password: _, ...safe } = updated;
    const changes = JSON.stringify(updateData);
    if (adminId) {
      await storage.createAuditLog({ adminId, action: "update_user", targetType: "user", targetId: req.params.id, details: changes, ip: req.ip ?? null }).catch(() => {});
    }
    console.log(`[admin] User ${req.params.id} updated: ${changes}`);
    return res.json(safe);
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    if (!(await isAdminAuthenticated(req))) {
      return res.status(401).json({ message: "Admin authentication required" });
    }
    const adminId = await getAdminFromSession(req);
    const target = await storage.getUser(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found" });
    try {
      const { data: sbUser } = await supabaseAdmin.auth.admin.listUsers();
      const match = sbUser?.users?.find((u: any) => u.email === target.email);
      if (match) await supabaseAdmin.auth.admin.deleteUser(match.id);
    } catch { /* non-fatal */ }
    await storage.deleteUser(req.params.id);
    if (adminId) {
      await storage.createAuditLog({ adminId, action: "delete_user", targetType: "user", targetId: req.params.id, details: target.email, ip: req.ip ?? null }).catch(() => {});
    }
    console.log(`[admin] User ${target.email} deleted`);
    return res.json({ ok: true });
  });

  app.get("/api/admin/groups", async (req, res) => {
    if (!(await isAdminAuthenticated(req))) {
      return res.status(401).json({ message: "Admin authentication required" });
    }
    try {
      const allGroups = await storage.getAllGroups();
      const withCounts = await Promise.all(allGroups.map(async g => {
        const members = await storage.getGroupMembers(g.id);
        return { ...g, memberCount: members.filter((m: any) => m.status === "approved").length };
      }));
      res.json(withCounts);
    } catch {
      res.status(500).json({ message: "Failed to fetch groups" });
    }
  });

  app.delete("/api/admin/groups/:id", async (req, res) => {
    if (!(await isAdminAuthenticated(req))) {
      return res.status(401).json({ message: "Admin authentication required" });
    }
    const adminId = await getAdminFromSession(req);
    try {
      await storage.deleteGroup(req.params.id);
      if (adminId) {
        await storage.createAuditLog({ adminId, action: "delete_group", targetType: "group", targetId: req.params.id, ip: req.ip ?? null }).catch(() => {});
      }
      res.json({ ok: true });
    } catch {
      res.status(500).json({ message: "Failed to delete group" });
    }
  });

  app.get("/api/ads/admin", async (req, res) => {
    if (!(await isAdminAuthenticated(req))) {
      return res.status(401).json({ message: "Admin authentication required" });
    }
    const allAds = await storage.getAllAds();
    return res.json(allAds);
  });

  app.post("/api/ads/admin/:id/approve", async (req, res) => {
    if (!(await isAdminAuthenticated(req))) {
      return res.status(401).json({ message: "Admin authentication required" });
    }
    const ad = await storage.getAdById(req.params.id);
    if (!ad) return res.status(404).json({ message: "Ad not found" });
    const tierInfo = AD_TIERS[ad.tier] || AD_TIERS.explorer;
    const expiresAt = new Date(Date.now() + tierInfo.days * 24 * 3600 * 1000);
    const adminId = await getAdminFromSession(req);
    const updated = await storage.updateAd(ad.id, { status: "approved", reviewedAt: new Date(), expiresAt, rejectionReason: null });
    if (adminId) {
      await storage.createAuditLog({ adminId, action: "approve_ad", targetType: "ad", targetId: ad.id, details: ad.advertiserName, ip: req.ip ?? null }).catch(() => {});
    }
    console.log(`[ads] Admin approved ad ${ad.id} (${ad.advertiserName})`);

    if ((ad as any).adType === "event" && (ad as any).submittedByUserId) {
      try {
        const matchedIds = await storage.getMatchedUserIds((ad as any).submittedByUserId);
        await Promise.all(matchedIds.map(uid =>
          storage.createNotification({
            userId: uid,
            type: "event_promotion",
            title: "Your match is hosting an event",
            body: ad.headline,
            data: JSON.stringify({ adId: ad.id, groupId: (ad as any).linkedGroupId }),
          })
        ));
        console.log(`[ads] Event ad ${ad.id} approved — notified ${matchedIds.length} matched users`);
      } catch (e: any) {
        console.error("[ads] Failed to notify matches:", e.message);
      }
    }

    return res.json(updated);
  });

  app.post("/api/ads/admin/:id/reject", async (req, res) => {
    if (!(await isAdminAuthenticated(req))) {
      return res.status(401).json({ message: "Admin authentication required" });
    }
    const adminId = await getAdminFromSession(req);
    const { reason } = req.body;
    const updated = await storage.updateAd(req.params.id, { status: "rejected", reviewedAt: new Date(), rejectionReason: reason || "Does not meet content guidelines" });
    if (adminId) {
      await storage.createAuditLog({ adminId, action: "reject_ad", targetType: "ad", targetId: req.params.id, details: reason ?? null, ip: req.ip ?? null }).catch(() => {});
    }
    console.log(`[ads] Admin rejected ad ${req.params.id}: ${reason}`);
    return res.json(updated);
  });

  app.get("/api/admin/audit-log", async (req, res) => {
    if (!(await isAdminAuthenticated(req))) {
      return res.status(401).json({ message: "Admin authentication required" });
    }
    const logs = await storage.getAuditLogs(parseInt(req.query.limit as string) || 200);
    return res.json(logs);
  });
}
