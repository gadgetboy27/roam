import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { Server as SocketServer } from "socket.io";
import { createHmac, timingSafeEqual } from "crypto";
import { storage } from "./storage";
import { comparePassword } from "./auth";
import { buildFingerprint, computeOverlap, detectAlmostMet, computeHonestyTier } from "./fingerprint";
import { getUncachableStripeClient } from "./stripeClient";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import rateLimit from "express-rate-limit";
import { supabaseAdmin } from "./supabaseAdmin";
import { hashAdminPassword, compareAdminPassword, isAdminAuthenticated, getAdminFromSession } from "./admin-auth";
import { pgConnectConfig } from "./db";
import {
  toPublicAd, PgRateLimitStore, authenticateRequest, messagePreview,
  uploadImageDataUrl, notifyNewMessage, notifyGroupMessage, DATA_DELETION_HTML,
} from "./http-helpers";

const PgSessionStore = connectPgSimple(session);
const isProd = process.env.NODE_ENV === "production";


// Rate limiters are initialised inside registerRoutes() once the pg.Pool exists.
// Declared here so they can be referenced in route registrations below.
let loginLimiter: ReturnType<typeof rateLimit>;
let adminLoginLimiter: ReturnType<typeof rateLimit>;
let profileLimiter: ReturnType<typeof rateLimit>;
let verifyLimiter: ReturnType<typeof rateLimit>;
let uploadLimiter: ReturnType<typeof rateLimit>;


export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Server-side data deletion page — Facebook URL validator and crawlers
  // require a real HTML response, not a client-side React route.
  app.get("/data-deletion", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(DATA_DELETION_HTML);
  });

  // Facebook Data Deletion Callback endpoint (POST).
  // Use this URL in Facebook App Settings → Data Deletion → Callback URL:
  //   https://letsroam.life/api/facebook/data-deletion
  // Facebook sends a signed_request (base64url header.payload signed with HMAC-SHA256).
  app.post("/api/facebook/data-deletion", (req, res) => {
    const { signed_request } = req.body || {};
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (appSecret && signed_request) {
      try {
        const [encodedSig, payload] = (signed_request as string).split(".");
        const expectedSig = createHmac("sha256", appSecret)
          .update(payload)
          .digest("base64url");
        const sigBuf = Buffer.from(encodedSig, "base64url");
        const expBuf = Buffer.from(expectedSig, "base64url");
        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
          console.warn("[facebook-deletion] invalid signature — rejecting");
          return res.status(400).json({ error: "Invalid signature" });
        }
      } catch {
        return res.status(400).json({ error: "Malformed signed_request" });
      }
    } else if (!signed_request) {
      console.warn("[facebook-deletion] no signed_request present");
    }

    const confirmationCode = `roam-del-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const appUrl = process.env.APP_URL || "https://letsroam.life";
    return res.json({
      url: `${appUrl}/data-deletion?confirmation=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  });

  const allowedOrigins = isProd
    ? ["https://letsroam.life", "https://www.letsroam.life"]
    : ["http://localhost:5000", "http://localhost:5173"];

  const io = new SocketServer(httpServer, {
    path: "/socket.io",
    cors: { origin: allowedOrigins, methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
  });

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
  // Ensure the Supabase Storage bucket exists (idempotent — no-op if already present)
  await supabaseAdmin.storage.createBucket("photos", { public: true }).catch(() => {});


  const sessionPool = new pg.Pool(pgConnectConfig(process.env.DATABASE_URL));

  // Ensure the rate_limits table exists (idempotent)
  await sessionPool.query(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key text PRIMARY KEY,
      count integer NOT NULL DEFAULT 0,
      reset_at timestamptz NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits(reset_at);
  `).catch((e) => console.error("[rate-limit] Table creation error:", e.message));

  // Clean up expired rows periodically (every 10 min) to prevent unbounded growth
  setInterval(() => {
    sessionPool.query("DELETE FROM rate_limits WHERE reset_at < NOW()").catch(() => {});
  }, 10 * 60 * 1000);

  const makeLimiter = (max: number, windowMs: number, msg?: string) => rateLimit({
    windowMs,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: msg ?? `Too many requests. Try again in ${Math.round(windowMs / 60000)} minutes.` },
    store: new PgRateLimitStore(sessionPool, windowMs, `rl`),
  });

  loginLimiter      = makeLimiter(5,  15 * 60 * 1000, "Too many login attempts. Please try again in 15 minutes.");
  adminLoginLimiter = makeLimiter(3,  30 * 60 * 1000, "Too many admin login attempts. Please try again in 30 minutes.");
  profileLimiter    = makeLimiter(10, 60 * 60 * 1000);
  verifyLimiter     = makeLimiter(3,  60 * 60 * 1000, "Too many verification attempts. Please try again in an hour.");
  uploadLimiter     = makeLimiter(30, 60 * 60 * 1000);

  app.use(
    session({
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: isProd,
        httpOnly: true,
        sameSite: isProd ? "strict" : "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      },
      store: new PgSessionStore({
        pool: sessionPool,
        tableName: "user_sessions",
        createTableIfMissing: true,
      }),
    })
  );

  app.post("/api/auth/login", loginLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const valid = await comparePassword(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      (req.session as any).userId = user.id;

      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Server error" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  });

  app.post("/api/auth/profile", profileLimiter, async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Supabase token required" });
      }
      const token = authHeader.slice(7);
      const { data: { user: sbUser }, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !sbUser?.email) {
        return res.status(401).json({ message: "Invalid token" });
      }

      const existing = await storage.getUserByEmail(sbUser.email);
      if (existing) {
        const { password: _, ...safe } = existing;
        return res.json(safe);
      }

      const { name, dob, gender, ethnicity, location, tagline, tier, photoLicenseAgreed } = req.body;
      if (!name) return res.status(400).json({ message: "Name is required" });

      const FOUNDING_MEMBER_LIMIT = 50;
      const foundingCount = await storage.countFoundingMembers();
      const isFoundingMember = foundingCount < FOUNDING_MEMBER_LIMIT;

      const newUser = await storage.createUser({
        name,
        email: sbUser.email,
        password: "SUPABASE_AUTH",
        dob: dob || null,
        gender: gender || null,
        ethnicity: ethnicity || null,
        location: location || null,
        tagline: tagline || null,
        tier: isFoundingMember ? "adventurer" : (tier || "free"),
        photoLicenseAgreed: !!photoLicenseAgreed,
        isFoundingMember,
        isTierGifted: false,
      });
      if (isFoundingMember) {
        console.log(`[founding] ${sbUser.email} is founding member #${foundingCount + 1}/${FOUNDING_MEMBER_LIMIT}`);
      }

      const { password: _, ...safe } = newUser;
      res.status(201).json(safe);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Silently register a legacy (bcrypt-only) user in Supabase after they've
  // successfully logged in via the fallback path. Fire-and-forget from the client.
  app.post("/api/auth/migrate-to-supabase", async (req, res) => {
    try {
      const userId = await authenticateRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ message: "email and password required" });
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      console.log(`[migrate] Created Supabase account for legacy user: ${email}`);
      res.json({ ok: true });
    } catch (err: any) {
      // Already exists is fine — nothing to do
      if (err.message?.toLowerCase().includes("already")) return res.json({ ok: true });
      console.warn("[migrate] Failed:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

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

  app.get("/api/users", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const [allUsers, heroPhotoMap] = await Promise.all([
      storage.getAllUsers(),
      storage.getFirstApprovedPhotoPerUser(),
    ]);
    const safe = allUsers.map(({ password: _, email: _e, stripeCustomerId: _sc, stripeSubscriptionId: _ss, identityVerificationId: _vi, identityVerifiedAt: _vat, photoLicenseAgreed: _pla, ...u }) => ({
      ...u,
      heroPhotoUrl: heroPhotoMap[u.id] ?? null,
    }));
    res.json(safe);
  });

  app.get("/api/discover", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const [currentUser, currentPhotos, interactedIds, allUsers, heroPhotoMap] = await Promise.all([
      storage.getUser(userId),
      storage.getPhotosByUser(userId),
      storage.getInteractedUserIds(userId),
      storage.getAllUsers(),
      storage.getFirstApprovedPhotoPerUser(),
    ]);

    if (!currentUser) return res.status(404).json({ message: "User not found" });

    const myFp = buildFingerprint(currentPhotos, currentUser.adventureTags);
    const interactedSet = new Set(interactedIds);

    // Load block lists — exclude anyone the user blocked or who blocked them
    let blockedIds = new Set<string>();
    try {
      const { Pool } = await import("pg");
      const pool = new Pool(pgConnectConfig(process.env.DATABASE_URL));
      const { rows } = await pool.query(
        `SELECT blocked_id FROM blocks WHERE blocker_id = $1
         UNION SELECT blocker_id FROM blocks WHERE blocked_id = $1`,
        [userId]
      );
      await pool.end();
      blockedIds = new Set(rows.map((r: any) => r.blocked_id ?? r.blocker_id));
    } catch { /* non-fatal — degrade gracefully */ }

    const candidates = allUsers.filter(u => {
      if (u.id === userId) return false;
      if (interactedSet.has(u.id)) return false;
      if (blockedIds.has(u.id)) return false;
      // Safety mode: only show verified users to users who enabled it
      if (currentUser.safetyModeEnabled && !u.identityVerified) return false;
      return true;
    });

    // Bulk-load all candidate photos + bucket lists in parallel (eliminates N+1)
    const candidateIds = candidates.map(c => c.id);
    const [allCandidatePhotos] = await Promise.all([
      storage.getAllPhotosForUsers(candidateIds),
    ]);

    // Bucket List matching — fetch current user's and all candidates' pinned destinations
    let myBucketList = new Set<string>();
    const candidateBucketMap = new Map<string, Set<string>>();
    try {
      const { Pool } = await import("pg");
      const pool = new Pool(pgConnectConfig(process.env.DATABASE_URL));
      const [myBL, candidateBLs] = await Promise.all([
        pool.query("SELECT destination_name FROM bucket_list WHERE user_id = $1", [userId]),
        candidateIds.length > 0
          ? pool.query("SELECT user_id, destination_name FROM bucket_list WHERE user_id = ANY($1)", [candidateIds])
          : Promise.resolve({ rows: [] }),
      ]);
      await pool.end();
      myBucketList = new Set(myBL.rows.map((r: any) => (r.destination_name as string).toLowerCase().trim()));
      for (const row of candidateBLs.rows) {
        if (!candidateBucketMap.has(row.user_id)) candidateBucketMap.set(row.user_id, new Set());
        candidateBucketMap.get(row.user_id)!.add((row.destination_name as string).toLowerCase().trim());
      }
    } catch { /* non-fatal — degrade gracefully */ }

    const now = Date.now();

    const scored = candidates.map(candidate => {
      const candidatePhotos = allCandidatePhotos[candidate.id] ?? [];
      const candidateFp = buildFingerprint(candidatePhotos, candidate.adventureTags);
      const { score, sharedTags } = computeOverlap(myFp, candidateFp);
      const almostMet = detectAlmostMet(currentPhotos, candidatePhotos);
      const age = candidate.dob
        ? Math.floor((Date.now() - new Date(candidate.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
        : null;

      // Bucket list bonus: each shared destination adds 0.05, capped at 0.25
      const candidateBL = candidateBucketMap.get(candidate.id) ?? new Set<string>();
      const sharedDestinations = [...myBucketList].filter(d => candidateBL.has(d));
      const bucketBonus = Math.min(sharedDestinations.length * 0.05, 0.25);

      const isBoostActive = !!(candidate.boostExpiresAt && new Date(candidate.boostExpiresAt).getTime() > now);

      return {
        id: candidate.id,
        name: candidate.name,
        age,
        ethnicity: candidate.ethnicity,
        tagline: candidate.tagline,
        heroPhotoUrl: heroPhotoMap[candidate.id] ?? candidate.avatarUrl ?? null,
        adventureTags: candidate.adventureTags,
        identityVerified: candidate.identityVerified,
        openToRoaming: candidate.openToRoaming,
        overlapScore: score + bucketBonus,
        sharedTags,
        sharedDestinations,
        almostMet,
        isBoostActive,
        tier: candidate.tier,
      };
    });

    scored.sort((a, b) => {
      // 1. Active boosts always surface first
      if (a.isBoostActive !== b.isBoostActive) return a.isBoostActive ? -1 : 1;
      // 2. Almost Met — shared physical location is the strongest signal
      if (a.almostMet && !b.almostMet) return -1;
      if (!a.almostMet && b.almostMet) return 1;
      // 3. Adventurer tier gets a small priority bump (0.05) for paying for the service
      const aTierBonus = a.tier === "adventurer" ? 0.05 : 0;
      const bTierBonus = b.tier === "adventurer" ? 0.05 : 0;
      return (b.overlapScore + bTierBonus) - (a.overlapScore + aTierBonus);
    });

    res.json(scored);
  });

  app.post("/api/matches/pass", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { targetId } = req.body;
    if (!targetId) return res.status(400).json({ message: "targetId required" });
    try {
      await storage.createPass(userId, targetId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    const sessionUserId = await authenticateRequest(req);
    if (!sessionUserId || sessionUserId !== req.params.id) {
      return res.status(401).json({ message: "Not authorized" });
    }
    const { name, tagline, location, avatarUrl, adventureTags } = req.body;
    if (tagline !== undefined && typeof tagline === "string" && tagline.length > 60) {
      return res.status(400).json({ message: "Tagline must be 60 characters or less" });
    }
    if (name !== undefined && typeof name === "string" && name.length > 100) {
      return res.status(400).json({ message: "Name must be 100 characters or less" });
    }
    try {
      const updated = await storage.updateUser(req.params.id, {
        ...(name !== undefined && { name }),
        ...(tagline !== undefined && { tagline }),
        ...(location !== undefined && { location }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(adventureTags !== undefined && { adventureTags }),
      });
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { password: _, ...safeUser } = updated;
      res.json(safeUser);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/bucket-list/:id", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const item = await storage.getBucketItem(req.params.id);
      if (!item) return res.status(404).json({ message: "Not found" });
      if (item.userId !== userId) return res.status(403).json({ message: "Not authorized" });
      await storage.deleteBucketItem(req.params.id);
      res.json({ message: "Deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/users/:id/photos", async (req, res) => {
    const authUserId = await authenticateRequest(req);
    if (!authUserId) return res.status(401).json({ message: "Not authenticated" });
    const allPhotos = await storage.getPhotosByUser(req.params.id);
    if (authUserId === req.params.id) {
      return res.json(allPhotos);
    }
    const publicPhotos = allPhotos
      .filter(p => p.verdict === "approved")
      .map(({ id, storageUrl, caption, displayOrder, createdAt }) => ({ id, storageUrl, caption, displayOrder, createdAt }));
    res.json(publicPhotos);
  });

  app.post("/api/photos", uploadLimiter, async (req, res) => {
    const authUserId = await authenticateRequest(req);
    if (!authUserId) return res.status(401).json({ message: "Not authenticated" });
    if (req.body.userId && req.body.userId !== authUserId) {
      return res.status(403).json({ message: "Cannot create photos for another user" });
    }
    try {
      const photo = await storage.createPhoto(req.body);
      res.status(201).json(photo);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/upload", uploadLimiter, async (req, res) => {
    try {
      const authUserId = await authenticateRequest(req);
      if (!authUserId) return res.status(401).json({ message: "Not authenticated" });

      const { dataUrl, filename, userId, caption, displayOrder } = req.body;
      if (!dataUrl || !filename || !userId) {
        return res.status(400).json({ message: "dataUrl, filename, userId required" });
      }
      if (caption !== undefined && typeof caption === "string" && caption.length > 200) {
        return res.status(400).json({ message: "Caption must be 200 characters or less" });
      }
      if (userId !== authUserId) {
        return res.status(403).json({ message: "Cannot upload photos for another user" });
      }

      const upload = await uploadImageDataUrl(userId, dataUrl);
      if (!upload.ok) return res.status(upload.status).json({ message: upload.message });

      const photo = await storage.createPhoto({
        userId,
        storageUrl: upload.url,
        caption: caption || null,
        displayOrder: displayOrder ?? 0,
        personScore: 0,
        authenticityScore: 100,
        adventureScore: 0,
        verdict: "approved",
        isLicensable: false,
      });

      res.status(201).json(photo);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/matches", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const userMatches = await storage.getMatchesForUser(userId);
    res.json(userMatches);
  });

  app.post("/api/matches", async (req, res) => {
    // Must be authenticated — the initiator must be the session user
    const sessionUserId = await authenticateRequest(req);
    if (!sessionUserId) return res.status(401).json({ message: "Not authenticated" });

    try {
      const { userAId, userBId, status } = req.body;
      if (!userAId || !userBId) return res.status(400).json({ message: "userAId and userBId are required" });

      // Prevent forging likes on behalf of other users
      if (userAId !== sessionUserId) {
        return res.status(403).json({ message: "Forbidden — you can only like as yourself" });
      }

      // Block matches involving demo profiles — they are display-only placeholders
      if (String(userAId).startsWith("demo-") || String(userBId).startsWith("demo-")) {
        return res.json({ isNewMatch: false, demo: true });
      }

      // Enforce free-tier connection limit (3 per month)
      const initiatorId = sessionUserId;
      const initiator = await storage.getUser(initiatorId);
      if (initiator && (initiator.tier === "free" || !initiator.tier)) {
        const sentThisMonth = await storage.getMonthlyConnectionsSent(initiatorId);
        if (sentThisMonth >= 3) {
          return res.status(403).json({
            message: "Free plan limit reached",
            limitReached: true,
            upgradeRequired: true,
          });
        }
      }

      const existing = await storage.getMatchBetween(userAId, userBId);
      if (existing) {
        if (
          (existing.status === "liked_b" && existing.userBId === userAId) ||
          (existing.status === "liked_a" && existing.userAId === userBId)
        ) {
          const updated = await storage.updateMatchStatus(existing.id, "matched", { matchedAt: new Date() });
          // Tell the other person they have a new mutual connection so the bell
          // alerts them — without this, matches happened silently.
          const otherUserId = userAId === sessionUserId ? userBId : userAId;
          storage.getUser(sessionUserId).then(me =>
            storage.createNotification({
              userId: otherUserId,
              type: "match",
              title: "New connection!",
              body: me?.name ? `You and ${me.name} both want to roam together` : "You have a new mutual connection",
              data: JSON.stringify({ matchId: updated?.id ?? existing.id }),
            })
          ).catch(() => {});
          return res.json({ ...updated, isNewMatch: true });
        }
        return res.json({ ...existing, isNewMatch: false, alreadyExists: true });
      }

      // Silently compute adventure fingerprint overlap — never exposed to clients
      let overlapScore = 0;
      let sharedTags: string[] = [];
      let almostMetLocation: string | null = null;
      let almostMetDate: string | null = null;
      try {
        const [photosA, photosB, userA, userB] = await Promise.all([
          storage.getPhotosByUser(userAId),
          storage.getPhotosByUser(userBId),
          storage.getUser(userAId),
          storage.getUser(userBId),
        ]);
        if (userA && userB) {
          const fpA = buildFingerprint(photosA, userA.adventureTags);
          const fpB = buildFingerprint(photosB, userB.adventureTags);
          const overlap = computeOverlap(fpA, fpB);
          overlapScore = overlap.score;
          sharedTags = overlap.sharedTags;
          const almostMet = detectAlmostMet(photosA, photosB);
          if (almostMet) {
            almostMetLocation = almostMet.location;
            almostMetDate = almostMet.dateHint;
          }
        }
      } catch { /* fingerprint errors must never block match creation */ }

      const newStatus = status === "liked_b" ? "liked_b" : "liked_a";
      const match = await storage.createMatch({
        userAId, userBId, status: newStatus,
        overlapScore, sharedTags,
        ...(almostMetLocation && { almostMetLocation, almostMetDate }),
      });
      res.status(201).json({ ...match, isNewMatch: false });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/users/:id/honesty", async (req, res) => {
    const authUserId = await authenticateRequest(req);
    if (!authUserId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const photos = await storage.getPhotosByUser(req.params.id);
      const tier = computeHonestyTier(photos);
      res.json({ tier });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/matches/:id", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { status } = req.body;
    const updated = await storage.updateMatchStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ message: "Match not found" });
    res.json(updated);
  });

  app.get("/api/matches/:matchId/messages", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    // Verify requesting user is a participant in this match
    const match = await storage.getMatchById(req.params.matchId);
    if (!match) return res.status(404).json({ message: "Match not found" });
    if (match.userAId !== userId && match.userBId !== userId) {
      return res.status(403).json({ message: "Not authorised to view these messages" });
    }
    const msgs = await storage.getMessagesByMatch(req.params.matchId);
    res.json(msgs);
  });

  app.post("/api/messages", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    if (req.body.senderId && req.body.senderId !== userId) {
      return res.status(403).json({ message: "Cannot send messages as another user" });
    }
    const content: string = req.body.content ?? "";
    if (!content || content.length > 2000) {
      return res.status(400).json({ message: "Message must be 1–2000 characters" });
    }
    // Verify match exists, is mutually matched, and sender is a participant
    const match = await storage.getMatchById(req.body.matchId);
    if (!match) return res.status(404).json({ message: "Match not found" });
    if (match.status !== "matched") {
      return res.status(403).json({ message: "Messaging requires a mutual match" });
    }
    if (match.userAId !== userId && match.userBId !== userId) {
      return res.status(403).json({ message: "You are not a participant in this match" });
    }
    try {
      const msg = await storage.createMessage({ matchId: req.body.matchId, senderId: userId, content });
      // Deliver to anyone in the live chat room and alert the recipient's bell,
      // mirroring the socket path so HTTP-sent messages aren't silently dropped.
      io.to(`match:${req.body.matchId}`).emit("new_message", msg);
      notifyNewMessage(match, userId, content).catch(() => {});
      res.status(201).json(msg);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/bucket-list/:userId", async (req, res) => {
    const sessionUserId = await authenticateRequest(req);
    if (!sessionUserId) return res.status(401).json({ message: "Not authenticated" });
    if (sessionUserId !== req.params.userId) return res.status(403).json({ message: "Not authorized" });
    const items = await storage.getBucketListByUser(req.params.userId);
    res.json(items);
  });

  app.post("/api/bucket-list", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const name = typeof req.body?.destinationName === "string" ? req.body.destinationName.trim() : "";
      if (!name) return res.status(400).json({ message: "Destination name is required" });
      if (name.length > 80) return res.status(400).json({ message: "Destination name must be 80 characters or less" });
      const imageUrl = typeof req.body?.imageUrl === "string" && req.body.imageUrl.trim() ? req.body.imageUrl.trim() : null;

      // Prevent duplicates (case-insensitive) and cap the list size
      const existing = await storage.getBucketListByUser(userId);
      if (existing.length >= 30) return res.status(400).json({ message: "You can pin up to 30 destinations." });
      if (existing.some(b => b.destinationName.trim().toLowerCase() === name.toLowerCase())) {
        return res.status(409).json({ message: "You've already pinned that destination." });
      }

      const item = await storage.createBucketItem({ userId, destinationName: name, imageUrl });
      res.status(201).json(item);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Upload a photo for a dream destination. Stores it in the photos bucket under
  // the user's destinations/ prefix and returns the public URL — it does NOT
  // create a photos record, so it never appears among the user's adventure shots.
  app.post("/api/bucket-list/image", uploadLimiter, async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const upload = await uploadImageDataUrl(userId, req.body?.dataUrl, "destinations");
      if (!upload.ok) return res.status(upload.status).json({ message: upload.message });
      res.status(201).json({ url: upload.url });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // Stripe Hosted Checkout — Adventurer subscription ($4.99 NZD/month)
  // ---------------------------------------------------------------------------
  const checkoutLimiter = makeLimiter(5, 60 * 60 * 1000);

  app.post("/api/checkout/start", checkoutLimiter, async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const stripe = getUncachableStripeClient();
      const domain = process.env.APP_URL || "http://localhost:5000";
      const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: user.stripeCustomerId ? undefined : user.email,
        customer: user.stripeCustomerId || undefined,
        line_items: [{
          price_data: {
            currency: "nzd",
            product_data: {
              name: "roam. Adventurer",
              description: "Unlimited connections · Full messaging · Almost Met radar · Bucket List matching · Priority discovery",
              images: [],
            },
            unit_amount: 500,
            recurring: { interval: "month" },
          },
          quantity: 1,
        }],
        success_url: `${baseUrl}/profile?upgraded=1`,
        cancel_url: `${baseUrl}/profile`,
        metadata: { userId, type: "adventurer" },
        allow_promotion_codes: true,
      });

      return res.json({ url: session.url });
    } catch (err: any) {
      console.error("[checkout] Error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // Profile Boost — $5 NZD one-time, 24 hours of boosted discovery visibility
  // ---------------------------------------------------------------------------
  app.post("/api/checkout/boost", checkoutLimiter, async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const stripe = getUncachableStripeClient();
      const domain = process.env.APP_URL || "http://localhost:5000";
      const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: user.stripeCustomerId ? undefined : user.email,
        customer: user.stripeCustomerId || undefined,
        line_items: [{
          price_data: {
            currency: "nzd",
            product_data: {
              name: "roam. Profile Boost",
              description: "Get seen first in discovery for 24 hours",
            },
            unit_amount: 500,
          },
          quantity: 1,
        }],
        success_url: `${baseUrl}/profile?boosted=1`,
        cancel_url: `${baseUrl}/profile`,
        metadata: { userId, type: "boost" },
      });

      return res.json({ url: session.url });
    } catch (err: any) {
      console.error("[boost-checkout] Error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // Squad Leader Plan — $20 NZD one-time, permanent organiser tools
  // ---------------------------------------------------------------------------
  app.post("/api/checkout/organiser", checkoutLimiter, async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.isOrganiser) return res.status(400).json({ message: "Already a Squad Leader" });

      const stripe = getUncachableStripeClient();
      const domain = process.env.APP_URL || "http://localhost:5000";
      const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: user.stripeCustomerId ? undefined : user.email,
        customer: user.stripeCustomerId || undefined,
        line_items: [{
          price_data: {
            currency: "nzd",
            product_data: {
              name: "roam. Squad Leader",
              description: "Create unlimited groups · Ticketed events · Member management · Custom invites — one-time, yours forever",
            },
            unit_amount: 2000,
          },
          quantity: 1,
        }],
        success_url: `${baseUrl}/profile?squad=1`,
        cancel_url: `${baseUrl}/profile`,
        metadata: { userId, type: "organiser" },
      });

      return res.json({ url: session.url });
    } catch (err: any) {
      console.error("[organiser-checkout] Error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // Stripe Connect — organiser onboarding & payout account management
  // ---------------------------------------------------------------------------

  // Start or resume Connect Express onboarding
  app.post("/api/stripe/connect/start", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (!user.isOrganiser) return res.status(403).json({ message: "Squad Leader account required" });

      const stripe = getUncachableStripeClient();
      const domain = process.env.APP_URL || "http://localhost:5000";
      const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;

      // Create Express account if not already created
      let accountId = user.stripeConnectAccountId;
      if (!accountId) {
        const account = await stripe.accounts.create({
          type: "express",
          country: "NZ",
          email: user.email,
          capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
          business_type: "individual",
          metadata: { userId },
        });
        accountId = account.id;
        await storage.updateUser(userId, { stripeConnectAccountId: accountId, stripeConnectOnboarded: false });
      }

      // Generate a fresh Account Link
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${baseUrl}/api/stripe/connect/refresh`,
        return_url: `${baseUrl}/api/stripe/connect/return?userId=${userId}`,
        type: "account_onboarding",
      });

      return res.json({ url: accountLink.url });
    } catch (err: any) {
      console.error("[connect-start] Error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // Return URL after Stripe onboarding completes — check account status and redirect
  app.get("/api/stripe/connect/return", async (req, res) => {
    const { userId } = req.query as { userId: string };
    try {
      const user = userId ? await storage.getUser(userId) : null;
      if (user?.stripeConnectAccountId) {
        const stripe = getUncachableStripeClient();
        const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);
        if (account.charges_enabled && account.payouts_enabled) {
          await storage.updateUser(userId, { stripeConnectOnboarded: true });
        }
      }
    } catch (err: any) {
      console.warn("[connect-return] Status check failed:", err.message);
    }
    const domain = process.env.APP_URL || "http://localhost:5000";
    const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;
    return res.redirect(`${baseUrl}/profile?connect=success`);
  });

  // Refresh URL — link expired, generate a new one and redirect
  app.get("/api/stripe/connect/refresh", async (req, res) => {
    const domain = process.env.APP_URL || "http://localhost:5000";
    const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;
    return res.redirect(`${baseUrl}/profile?connect=refresh`);
  });

  // Get Connect account status for the logged-in user
  app.get("/api/stripe/connect/status", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const user = await storage.getUser(userId);
      if (!user?.stripeConnectAccountId) {
        return res.json({ status: "not_started", chargesEnabled: false, payoutsEnabled: false });
      }
      const stripe = getUncachableStripeClient();
      const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);
      const onboarded = account.charges_enabled && account.payouts_enabled;
      // Keep DB in sync
      if (onboarded && !user.stripeConnectOnboarded) {
        await storage.updateUser(userId, { stripeConnectOnboarded: true });
      }
      return res.json({
        status: onboarded ? "active" : "pending",
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        accountId: user.stripeConnectAccountId,
        dashboardUrl: "https://dashboard.stripe.com/express",
      });
    } catch (err: any) {
      console.error("[connect-status] Error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // Event Ticket Checkout — Stripe payment for ticketed group events (10% fee)
  // ---------------------------------------------------------------------------
  app.post("/api/events/:eventId/ticket/start", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const event = await storage.getGroupEvent(req.params.eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (!event.ticketPriceNzd) return res.status(400).json({ message: "This event is free — no ticket required" });

      const member = await storage.getGroupMember(event.groupId, userId);
      if (!member || member.status !== "approved") return res.status(403).json({ message: "You must be an approved group member to purchase a ticket" });

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const existing = await storage.getEventAttendee(event.id, userId);
      if (existing?.ticketPaid) return res.status(400).json({ message: "You already have a ticket" });

      const stripe = getUncachableStripeClient();
      const domain = process.env.APP_URL || "http://localhost:5000";
      const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;

      // ticketPriceNzd is what the organiser receives; attendee pays +10%
      const organiserCents = Math.round(event.ticketPriceNzd * 100);
      const totalCents     = Math.round(event.ticketPriceNzd * 110); // price × 1.10
      const feeCents       = totalCents - organiserCents;             // 10% for roam.

      // Check if the group leader has a connected Stripe account for auto-split
      const group = await storage.getGroup(event.groupId);
      let connectAccountId: string | null = null;
      if (group?.leaderId) {
        const leader = await storage.getUser(group.leaderId);
        if (leader?.stripeConnectAccountId && leader.stripeConnectOnboarded) {
          connectAccountId = leader.stripeConnectAccountId;
        }
      }

      const sessionParams: any = {
        mode: "payment",
        customer_email: user.stripeCustomerId ? undefined : user.email,
        customer: user.stripeCustomerId || undefined,
        line_items: [{
          price_data: {
            currency: "nzd",
            product_data: {
              name: `Ticket: ${event.title}`,
              description: connectAccountId
                ? `Event ticket · 10% roam. platform fee deducted automatically`
                : `Event ticket · includes 10% roam. platform fee`,
            },
            unit_amount: totalCents,
          },
          quantity: 1,
        }],
        success_url: `${baseUrl}/groups/${event.groupId}?tab=events&ticketed=1`,
        cancel_url: `${baseUrl}/groups/${event.groupId}?tab=events`,
        metadata: { userId, type: "event_ticket", eventId: event.id },
      };

      // Auto-split: organiser receives their share, roam. keeps the fee
      if (connectAccountId) {
        sessionParams.payment_intent_data = {
          application_fee_amount: feeCents,
          transfer_data: { destination: connectAccountId },
        };
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      return res.json({ url: session.url });
    } catch (err: any) {
      console.error("[event-ticket] Error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/checkout/portal", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const user = await storage.getUser(userId);
      if (!user?.stripeCustomerId) {
        return res.status(400).json({ message: "No active subscription found" });
      }
      const stripe = getUncachableStripeClient();
      const domain = process.env.APP_URL || "http://localhost:5000";
      const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;
      const portal = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${baseUrl}/profile`,
      });
      return res.json({ url: portal.url });
    } catch (err: any) {
      console.error("[portal] Error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ─── Ad system ───────────────────────────────────────────────────────────

  const AD_TIERS: Record<string, { label: string; price: number; days: number }> = {
    explorer:    { label: "Explorer",    price: 4900,  days: 7  },
    trailblazer: { label: "Trailblazer", price: 12900, days: 14 },
    summit:      { label: "Summit",      price: 29900, days: 30 },
  };

  app.post("/api/ads/submit", async (req, res) => {
    const { advertiserName, advertiserEmail, advertiserCompany, tier, headline, tagline, ctaText, ctaUrl, imageUrl, videoUrl, contentType, adType, linkedGroupId, linkedEventId, eventStartAt, eventLocation } = req.body;
    if (!advertiserName || !advertiserEmail || !tier || !headline) {
      return res.status(400).json({ message: "advertiserName, advertiserEmail, tier, and headline are required" });
    }
    const tierInfo = AD_TIERS[tier as string];
    if (!tierInfo) return res.status(400).json({ message: "Invalid tier. Must be explorer, trailblazer, or summit" });
    const submittedByUserId = req.session?.userId ?? undefined;

    const ad = await storage.createAd({ advertiserName, advertiserEmail, advertiserCompany, tier, headline, tagline, ctaText, ctaUrl, imageUrl, videoUrl, contentType: contentType || "image", status: "pending_payment", adType: adType || "standard", submittedByUserId: submittedByUserId || null, linkedGroupId: linkedGroupId || null, linkedEventId: linkedEventId || null, eventStartAt: eventStartAt ? new Date(eventStartAt) : null, eventLocation: eventLocation || null });

    try {
      const stripe = getUncachableStripeClient();
      const origin = req.headers.origin || "https://letsroam.life";
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        currency: "nzd",
        line_items: [{
          price_data: {
            currency: "nzd",
            unit_amount: tierInfo.price,
            product_data: { name: `roam. Ad Slot — ${tierInfo.label} (${tierInfo.days} days)`, description: headline },
          },
          quantity: 1,
        }],
        metadata: { type: "ad", adId: ad.id },
        customer_email: advertiserEmail,
        success_url: `${origin}/advertise/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/advertise`,
      });
      await storage.updateAd(ad.id, { stripeSessionId: session.id });
      return res.json({ checkoutUrl: session.url, adId: ad.id });
    } catch (err: any) {
      console.error("[ads] Stripe error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/ads/live", async (_req, res) => {
    const ad = await storage.getLiveAd();
    if (!ad) return res.json(null);
    await storage.updateAd(ad.id, { impressions: (ad.impressions ?? 0) + 1 });
    return res.json(toPublicAd(ad));
  });

  app.post("/api/ads/:id/click", async (req, res) => {
    const ad = await storage.getAdById(req.params.id);
    if (!ad) return res.status(404).json({ message: "Ad not found" });
    await storage.updateAd(ad.id, { clicks: (ad.clicks ?? 0) + 1 });
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

  // ─────────────────────────────────────────────────────────────────────────

  app.post("/api/stripe/payment-webhook", async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_PAYMENT_WEBHOOK_SECRET;
    let event: any;
    try {
      const stripe = getUncachableStripeClient();
      if (webhookSecret && sig) {
        event = stripe.webhooks.constructEvent(req.rawBody as Buffer, sig, webhookSecret);
      } else {
        if (process.env.NODE_ENV === "production") {
          return res.status(400).json({ error: "Webhook signature verification required in production" });
        }
        event = req.body;
        console.warn("[payment-webhook] No secret — skipping signature check (dev only)");
      }
    } catch (err: any) {
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    if (event?.type === "checkout.session.completed") {
      const session = event.data?.object;
      const metaType = session?.metadata?.type;

      if (metaType === "ad") {
        const adId = session?.metadata?.adId;
        if (adId) {
          await storage.updateAd(adId, { status: "pending_review" });
          console.log(`[payment] Ad ${adId} paid — moved to pending_review`);
        }
      } else if (metaType === "boost") {
        const userId = session?.metadata?.userId;
        if (userId) {
          const boostExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
          await storage.updateUser(userId, { boostExpiresAt: boostExpiry } as any);
          console.log(`[payment] User ${userId} boosted until ${boostExpiry.toISOString()}`);
        }
      } else if (metaType === "organiser") {
        const userId = session?.metadata?.userId;
        if (userId) {
          await storage.updateUser(userId, { isOrganiser: true } as any);
          console.log(`[payment] User ${userId} unlocked Squad Leader plan`);
        }
      } else if (metaType === "event_ticket") {
        const userId = session?.metadata?.userId;
        const eventId = session?.metadata?.eventId;
        if (userId && eventId) {
          const existing = await storage.getEventAttendee(eventId, userId);
          if (existing) {
            await storage.markTicketPaid(existing.id, session.id);
          } else {
            await storage.rsvpEventTicketed(eventId, userId, session.id);
          }
          console.log(`[payment] User ${userId} bought ticket for event ${eventId}`);
        }
      } else {
        const userId = session?.metadata?.userId;
        if (userId) {
          await storage.updateUser(userId, {
            tier: "adventurer",
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
          });
          console.log(`[payment] User ${userId} upgraded to Adventurer`);
        }
      }
    }

    if (event?.type === "customer.subscription.deleted") {
      const sub = event.data?.object;
      const customerId = sub?.customer;
      if (customerId) {
        const user = await storage.getUserByStripeCustomerId(customerId);
        if (user) {
          await storage.updateUser(user.id, { tier: "free", stripeSubscriptionId: null });
          console.log(`[payment] User ${user.id} downgraded to free (subscription cancelled)`);
        }
      }
    }

    if (event?.type === "customer.subscription.updated") {
      const sub = event.data?.object;
      const customerId = sub?.customer;
      const status = sub?.status;
      if (customerId && (status === "canceled" || status === "unpaid")) {
        const user = await storage.getUserByStripeCustomerId(customerId);
        if (user && user.tier !== "free") {
          await storage.updateUser(user.id, { tier: "free", stripeSubscriptionId: null });
          console.log(`[payment] User ${user.id} downgraded to free (subscription status: ${status})`);
        }
      }
    }

    if (event?.type === "invoice.payment_failed") {
      const invoice = event.data?.object;
      console.warn(`[payment] Payment failed for customer ${invoice?.customer}`);
    }

    return res.json({ received: true });
  });

  app.delete("/api/account", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const stripe = getUncachableStripeClient();
      if (user.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(user.stripeSubscriptionId);
        } catch (err: any) {
          console.warn("[account-delete] Stripe subscription cancel failed:", err.message);
        }
      }

      await storage.deleteUser(userId);

      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch (err: any) {
        console.warn("[account-delete] Supabase auth delete failed:", err.message);
      }

      console.log(`[account-delete] User ${userId} deleted their account`);
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("[account-delete] Error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/verify/start", verifyLimiter, async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    try {
      const stripe = getUncachableStripeClient();
      const domain = process.env.APP_URL || "http://localhost:5000";
      const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;

      const session = await stripe.identity.verificationSessions.create({
        type: "document",
        options: {
          document: {
            require_matching_selfie: true,
          },
        },
        return_url: `${baseUrl}/profile?verified=1`,
        metadata: { userId },
      });

      await storage.updateUserVerification(userId, session.id, false);

      return res.json({ url: session.url, sessionId: session.id });
    } catch (err: any) {
      console.error("Stripe Identity error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/verify/reset", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.identityVerified) return res.status(400).json({ message: "Already verified" });
      await storage.updateUserVerification(userId, null, false);
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("[verify-reset] Error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // Webhook-independent verification check. The webhook (below) is the primary
  // path, but if it is misconfigured or delayed the user would never be marked
  // verified. This endpoint asks Stripe directly for the session result and
  // updates the DB if it is verified — so verification works even with no webhook.
  app.post("/api/verify/status", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.identityVerified) return res.json({ verified: true });
      if (!user.identityVerificationId) return res.json({ verified: false });

      const stripe = getUncachableStripeClient();
      const session = await stripe.identity.verificationSessions.retrieve(user.identityVerificationId);

      if (session.status === "verified") {
        await storage.updateUserVerification(userId, session.id, true);
        console.log(`[verify-status] User ${userId} verified via direct Stripe check`);
        return res.json({ verified: true });
      }
      if (session.status === "requires_input") {
        return res.json({ verified: false, status: session.status, lastError: session.last_error });
      }
      return res.json({ verified: false, status: session.status });
    } catch (err: any) {
      console.error("[verify-status] Error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/stripe/identity-webhook", async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET;

    let event: any;
    try {
      const stripe = getUncachableStripeClient();
      if (webhookSecret && sig) {
        event = stripe.webhooks.constructEvent(
          req.rawBody as Buffer,
          sig,
          webhookSecret
        );
      } else {
        if (process.env.NODE_ENV === "production") {
          return res.status(400).json({ error: "Webhook signature verification required in production" });
        }
        event = req.body;
        console.warn("[identity-webhook] No secret configured — skipping signature check (dev only)");
      }
    } catch (err: any) {
      console.error("Webhook signature error:", err.message);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    if (event?.type === "identity.verification_session.verified") {
      const session = event.data?.object;
      const userId = session?.metadata?.userId;
      if (userId) {
        const user = await storage.getUser(userId);
        if (!user || user.identityVerificationId !== session.id) {
          console.warn(`[identity-webhook] Session ID mismatch for user ${userId} — ignoring event`);
          return res.json({ received: true });
        }
        await storage.updateUserVerification(userId, session.id, true);
        console.log(`[identity] User ${userId} verified successfully via Stripe Identity`);
      }
    }

    if (event?.type === "identity.verification_session.requires_input") {
      const session = event.data?.object;
      const userId = session?.metadata?.userId;
      if (userId) {
        console.log(`[identity] User ${userId} verification requires input — last error: ${JSON.stringify(session?.last_error)}`);
        await storage.updateUserVerification(userId, null, false);
      }
    }

    return res.json({ received: true });
  });

  // ─── Group eligibility helper ─────────────────────────────────────────────
  async function checkGroupLeaderEligibility(userId: string): Promise<{ eligible: boolean; reason?: string; checks?: Record<string, boolean> }> {
    const user = await storage.getUser(userId);
    if (!user) return { eligible: false, reason: "User not found" };
    const photos = await storage.getPhotosByUser(userId);
    const hasApprovedPhoto = photos.some(p => p.verdict === "approved");
    const tags = user.adventureTags ?? [];
    const isFoundingOrGifted = user.isFoundingMember || user.isTierGifted;
    const checks = {
      tier: user.tier === "adventurer" || user.tier === "contributor" || isFoundingOrGifted || user.isOrganiser,
      photo: hasApprovedPhoto,
      tagline: !!user.tagline,
      tags: tags.length >= 3,
    };
    if (!checks.tier) return { eligible: false, reason: "Adventurer subscription or Squad Leader plan required", checks };
    if (!checks.photo) return { eligible: false, reason: "At least one approved adventure photo required", checks };
    if (!checks.tagline) return { eligible: false, reason: "Add a tagline to your profile", checks };
    if (!checks.tags) return { eligible: false, reason: "Add at least 3 adventure tags to your profile", checks };
    return { eligible: true, checks };
  }

  // ─── Groups REST API ──────────────────────────────────────────────────────

  app.get("/api/groups", async (req, res) => {
    const allGroups = await storage.getAllGroups();
    const enriched = await Promise.all(allGroups.map(async g => {
      const members = await storage.getGroupMembers(g.id);
      const approvedCount = members.filter(m => m.status === "approved").length;
      return { ...g, memberCount: approvedCount };
    }));
    res.json(enriched);
  });

  app.get("/api/groups/my-led", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.json([]);
    const led = await storage.getGroupsLedByUser(userId);
    res.json(led);
  });

  app.get("/api/groups/:id", async (req, res) => {
    const group = await storage.getGroup(req.params.id);
    if (!group) return res.status(404).json({ error: "Group not found" });
    const members = await storage.getGroupMembers(req.params.id);
    const approvedCount = members.filter(m => m.status === "approved").length;
    res.json({ ...group, memberCount: approvedCount });
  });

  app.post("/api/groups", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const eligibility = await checkGroupLeaderEligibility(userId);
    if (!eligibility.eligible) return res.status(403).json({ error: eligibility.reason });
    const { name, description, type, location, adventureTags, coverImageUrl, visibility } = req.body;
    if (!name || !type) return res.status(400).json({ error: "name and type are required" });
    const maxSizeMap: Record<string, number> = { squad: 5, crew: 20, community: 100, organiser: 1000 };
    const group = await storage.createGroup({
      name,
      description: description ?? null,
      type,
      maxSize: maxSizeMap[type] ?? 5,
      leaderId: userId,
      location: location ?? null,
      adventureTags: adventureTags ?? null,
      coverImageUrl: coverImageUrl ?? null,
      visibility: visibility ?? "open",
      isActive: true,
    });
    await storage.addGroupMember({ groupId: group.id, userId, role: "leader", status: "approved", joinedAt: new Date() });
    res.json(group);
  });

  app.patch("/api/groups/:id", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const group = await storage.getGroup(req.params.id);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (group.leaderId !== userId) return res.status(403).json({ error: "Only the group leader can edit the group" });
    const { name, description, location, adventureTags, coverImageUrl, visibility } = req.body;
    const updated = await storage.updateGroup(req.params.id, { name, description, location, adventureTags, coverImageUrl, visibility } as any);
    res.json(updated);
  });

  app.delete("/api/groups/:id", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const group = await storage.getGroup(req.params.id);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (group.leaderId !== userId) return res.status(403).json({ error: "Only the group leader can dissolve the group" });
    await storage.deleteGroup(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/groups/eligibility/check", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const result = await checkGroupLeaderEligibility(userId);
    res.json(result);
  });

  // ─── Group members ────────────────────────────────────────────────────────

  app.get("/api/groups/:id/members", async (req, res) => {
    const sessionUserId = await authenticateRequest(req);
    if (!sessionUserId) return res.status(401).json({ message: "Not authenticated" });
    const group = await storage.getGroup(req.params.id);
    if (!group) return res.status(404).json({ message: "Group not found" });
    const isLeader = group.leaderId === sessionUserId;
    const allMembers = await storage.getGroupMembers(req.params.id);
    const visibleMembers = isLeader ? allMembers : allMembers.filter(m => m.status === "approved");
    const enriched = await Promise.all(visibleMembers.map(async m => {
      const user = await storage.getUser(m.userId);
      const hero = await storage.getHeroPhoto(m.userId);
      return { ...m, user: user ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl, location: user.location, tier: user.tier, heroPhotoUrl: hero?.url ?? null } : null };
    }));
    res.json(enriched);
  });

  app.post("/api/groups/:id/join", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const group = await storage.getGroup(req.params.id);
    if (!group || !group.isActive) return res.status(404).json({ error: "Group not found" });
    const existing = await storage.getGroupMember(req.params.id, userId);
    if (existing) return res.status(409).json({ error: "Already a member or pending" });
    const members = await storage.getGroupMembers(req.params.id);
    const approved = members.filter(m => m.status === "approved").length;
    if (approved >= group.maxSize) return res.status(400).json({ error: "Group is full" });
    const status = group.visibility === "open" ? "approved" : "pending";
    const member = await storage.addGroupMember({
      groupId: req.params.id,
      userId,
      role: "member",
      status,
      joinedAt: status === "approved" ? new Date() : undefined,
    });
    if (status === "pending") {
      await storage.createNotification({ userId: group.leaderId, type: "join_request", title: "New join request", body: `Someone wants to join ${group.name}`, data: JSON.stringify({ groupId: group.id }) });
    }
    res.json(member);
  });

  app.post("/api/groups/:id/leave", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const group = await storage.getGroup(req.params.id);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (group.leaderId === userId) return res.status(400).json({ error: "Leader cannot leave — transfer leadership or dissolve the group" });
    await storage.removeGroupMember(req.params.id, userId);
    res.json({ success: true });
  });

  app.patch("/api/groups/:id/members/:userId/approve", async (req, res) => {
    const requesterId = req.session?.userId;
    if (!requesterId) return res.status(401).json({ error: "Unauthorised" });
    const group = await storage.getGroup(req.params.id);
    if (!group || group.leaderId !== requesterId) return res.status(403).json({ error: "Only the group leader can approve members" });
    const member = await storage.getGroupMember(req.params.id, req.params.userId);
    if (!member) return res.status(404).json({ error: "Member not found" });
    const updated = await storage.updateGroupMember(member.id, { status: "approved", joinedAt: new Date() });
    await storage.createNotification({ userId: req.params.userId, type: "join_approved", title: "Join request approved", body: `You've been approved to join ${group.name}!`, data: JSON.stringify({ groupId: group.id }) });
    res.json(updated);
  });

  app.patch("/api/groups/:id/members/:userId/reject", async (req, res) => {
    const requesterId = req.session?.userId;
    if (!requesterId) return res.status(401).json({ error: "Unauthorised" });
    const group = await storage.getGroup(req.params.id);
    if (!group || group.leaderId !== requesterId) return res.status(403).json({ error: "Only the group leader can reject members" });
    await storage.removeGroupMember(req.params.id, req.params.userId);
    res.json({ success: true });
  });

  app.delete("/api/groups/:id/members/:userId", async (req, res) => {
    const requesterId = req.session?.userId;
    if (!requesterId) return res.status(401).json({ error: "Unauthorised" });
    const group = await storage.getGroup(req.params.id);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (group.leaderId !== requesterId && requesterId !== req.params.userId) return res.status(403).json({ error: "Forbidden" });
    await storage.removeGroupMember(req.params.id, req.params.userId);
    res.json({ success: true });
  });

  // ─── Campsite (group messages) ────────────────────────────────────────────

  app.get("/api/groups/:id/messages", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const member = await storage.getGroupMember(req.params.id, userId);
    if (!member || member.status !== "approved") return res.status(403).json({ error: "You are not a member of this group" });
    const msgs = await storage.getGroupMessages(req.params.id, 100);
    const enriched = await Promise.all(msgs.map(async m => {
      const sender = await storage.getUser(m.senderId);
      return { ...m, sender: sender ? { id: sender.id, name: sender.name, avatarUrl: sender.avatarUrl } : null };
    }));
    res.json(enriched);
  });

  // ─── Squad Leader broadcast ───────────────────────────────────────────────

  app.post("/api/groups/:id/broadcast", async (req, res) => {
    const requesterId = await authenticateRequest(req);
    if (!requesterId) return res.status(401).json({ error: "Unauthorised" });

    const group = await storage.getGroup(req.params.id);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (group.leaderId !== requesterId) return res.status(403).json({ error: "Only the group leader can send announcements" });

    const { message: content, recipientIds } = req.body as { message: string; recipientIds: string[] };
    if (!content?.trim()) return res.status(400).json({ error: "Message is required" });
    if (!Array.isArray(recipientIds) || recipientIds.length === 0) return res.status(400).json({ error: "Select at least one recipient" });

    // Verify all recipients are approved members
    const allMembers = await storage.getGroupMembers(req.params.id);
    const approvedIds = new Set(allMembers.filter(m => m.status === "approved").map(m => m.userId));
    const validRecipients = recipientIds.filter(uid => approvedIds.has(uid) && uid !== requesterId);
    if (validRecipients.length === 0) return res.status(400).json({ error: "No valid recipients" });

    // Post as an announcement in the campsite
    const leader = await storage.getUser(requesterId);
    const msg = await storage.createGroupMessage({ groupId: req.params.id, senderId: requesterId, content: content.trim(), isAnnouncement: true });

    // Notify each recipient
    await Promise.all(validRecipients.map(uid =>
      storage.createNotification({
        userId: uid,
        type: "group_broadcast",
        title: `📢 ${group.name}`,
        body: content.trim().length > 80 ? content.trim().slice(0, 80) + "…" : content.trim(),
        data: JSON.stringify({ groupId: req.params.id }),
      })
    ));

    res.json({ success: true, message: { ...msg, sender: leader ? { id: leader.id, name: leader.name, avatarUrl: leader.avatarUrl } : null }, recipientCount: validRecipients.length });
  });

  // ─── Group events ─────────────────────────────────────────────────────────

  app.get("/api/groups/:id/events", async (req, res) => {
    const events = await storage.getGroupEvents(req.params.id);
    res.json(events);
  });

  app.post("/api/groups/:id/events", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const group = await storage.getGroup(req.params.id);
    if (!group) return res.status(404).json({ error: "Group not found" });
    const member = await storage.getGroupMember(req.params.id, userId);
    if (!member || member.status !== "approved" || (member.role !== "leader" && member.role !== "moderator")) {
      return res.status(403).json({ error: "Only leaders can create events" });
    }
    const { title, description, location, startAt, endAt, ticketPriceNzd } = req.body;
    if (!title || !startAt) return res.status(400).json({ error: "title and startAt are required" });
    const parsedTicketPrice = ticketPriceNzd ? Math.round(parseFloat(ticketPriceNzd) * 100) : null;
    const event = await storage.createGroupEvent({
      groupId: req.params.id,
      createdBy: userId,
      title,
      description: description ?? null,
      location: location ?? null,
      startAt: new Date(startAt),
      endAt: endAt ? new Date(endAt) : null,
      ticketPriceNzd: parsedTicketPrice,
    });
    const members = await storage.getGroupMembers(req.params.id);
    const approved = members.filter(m => m.status === "approved" && m.userId !== userId);
    await Promise.all(approved.map(m => storage.createNotification({ userId: m.userId, type: "group_event", title: "New group event", body: `${group.name}: ${title}`, data: JSON.stringify({ groupId: group.id, eventId: event.id }) })));
    res.json(event);
  });

  app.delete("/api/groups/:id/events/:eventId", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const group = await storage.getGroup(req.params.id);
    if (!group || group.leaderId !== userId) return res.status(403).json({ error: "Only the group leader can delete events" });
    const event = await storage.getGroupEvent(req.params.eventId);
    if (!event || event.groupId !== req.params.id) return res.status(404).json({ error: "Event not found in this group" });
    await storage.deleteGroupEvent(req.params.eventId);
    res.json({ success: true });
  });

  // ─── Group Invites ────────────────────────────────────────────────────────

  app.post("/api/groups/:id/invites", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const group = await storage.getGroup(req.params.id);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (group.leaderId !== userId) return res.status(403).json({ error: "Only the group leader can invite members" });
    const { email, message } = req.body;
    if (!email || typeof email !== "string") return res.status(400).json({ error: "Email required" });
    const normalised = email.trim().toLowerCase();
    const existing = await storage.getGroupInvitesByGroup(group.id);
    const alreadyInvited = existing.find(i => i.invitedEmail === normalised && i.status === "pending");
    if (alreadyInvited) return res.status(409).json({ error: "This person has already been invited and hasn't responded yet" });
    const { randomUUID } = await import("crypto");
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invite = await storage.createGroupInvite({
      groupId: group.id,
      invitedEmail: normalised,
      invitedByUserId: userId,
      token,
      message: message || null,
      expiresAt,
    });
    const inviteUrl = `${req.protocol}://${req.get("host")}/invite/${token}`;
    const inviter = await storage.getUser(userId);
    const inviterName = inviter?.name || "Someone";
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "LetsRoam.life <noreply@letsroam.life>",
          to: normalised,
          subject: `${inviterName} invited you to join ${group.name} on LetsRoam.life`,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;background:#0e1a0d;color:#e8dcc8;padding:32px;border-radius:16px">
              <h1 style="font-size:28px;margin-bottom:4px;color:#e8dcc8">roam.</h1>
              <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(232,220,200,0.4);margin-top:0">adventure matching</p>
              <hr style="border-color:rgba(232,220,200,0.1);margin:24px 0"/>
              <p style="font-size:16px;color:rgba(232,220,200,0.85)"><strong style="color:#e8dcc8">${inviterName}</strong> has invited you to join <strong style="color:#a4e63a">${group.name}</strong> on roam.</p>
              ${message ? `<blockquote style="border-left:3px solid rgba(164,230,58,0.4);margin:16px 0;padding:8px 16px;color:rgba(232,220,200,0.6);font-style:italic">${message}</blockquote>` : ""}
              <p style="color:rgba(232,220,200,0.5);font-size:13px">Joining connects you with adventure-minded people planning real experiences together.</p>
              <a href="${inviteUrl}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:#a4e63a;color:#0e1a0d;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px">Accept Invite</a>
              <p style="color:rgba(232,220,200,0.3);font-size:11px;margin-top:24px">This invite expires in 7 days. If you didn't expect this, you can safely ignore it.</p>
            </div>
          `,
        });
      } catch (e) {
        console.warn("[invite] Email send failed:", e);
      }
    }
    res.json({ success: true, inviteUrl, token: invite.token });
  });

  app.get("/api/groups/:id/invites", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const group = await storage.getGroup(req.params.id);
    if (!group || group.leaderId !== userId) return res.status(403).json({ error: "Forbidden" });
    const invites = await storage.getGroupInvitesByGroup(req.params.id);
    res.json(invites);
  });

  app.get("/api/invites/:token", async (req, res) => {
    const invite = await storage.getGroupInviteByToken(req.params.token);
    if (!invite) return res.status(404).json({ error: "Invite not found" });
    if (invite.status !== "pending") return res.status(410).json({ error: "This invite has already been used or expired", status: invite.status });
    if (new Date() > invite.expiresAt) {
      await storage.updateGroupInviteStatus(invite.id, "expired");
      return res.status(410).json({ error: "This invite has expired" });
    }
    const group = await storage.getGroup(invite.groupId);
    const inviter = await storage.getUser(invite.invitedByUserId);
    res.json({
      invite,
      group: group ? { id: group.id, name: group.name, description: group.description, type: group.type, visibility: group.visibility, coverImageUrl: group.coverImageUrl } : null,
      inviterName: inviter?.name || "A member",
    });
  });

  app.post("/api/invites/:token/accept", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Login required to accept this invite" });
    const invite = await storage.getGroupInviteByToken(req.params.token);
    if (!invite) return res.status(404).json({ error: "Invite not found" });
    if (invite.status !== "pending") return res.status(410).json({ error: "This invite has already been used or expired" });
    if (new Date() > invite.expiresAt) {
      await storage.updateGroupInviteStatus(invite.id, "expired");
      return res.status(410).json({ error: "This invite has expired" });
    }
    const existing = await storage.getGroupMember(invite.groupId, userId);
    if (existing) {
      await storage.updateGroupInviteStatus(invite.id, "accepted");
      return res.json({ success: true, alreadyMember: true });
    }
    const group = await storage.getGroup(invite.groupId);
    if (!group) return res.status(404).json({ error: "Group no longer exists" });
    const members = await storage.getGroupMembers(invite.groupId);
    const approvedCount = members.filter(m => m.status === "approved").length;
    if (approvedCount >= group.maxSize) return res.status(409).json({ error: "This group is now full" });
    await storage.addGroupMember({ groupId: invite.groupId, userId, role: "member", status: "pending" });
    await storage.updateGroupInviteStatus(invite.id, "accepted");
    const leader = group.leaderId;
    await storage.createNotification({
      userId: leader,
      type: "group_invite_accepted",
      title: "Invite accepted",
      body: `Someone accepted your invite to ${group.name} — check their profile before approving.`,
      data: JSON.stringify({ groupId: group.id }),
    });
    res.json({ success: true, groupId: invite.groupId });
  });

  // ─── Event RSVP ───────────────────────────────────────────────────────────

  app.post("/api/events/:eventId/rsvp", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const event = await storage.getGroupEvent(req.params.eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });
    const member = await storage.getGroupMember(event.groupId, userId);
    if (!member || member.status !== "approved") return res.status(403).json({ error: "You must be an approved group member to RSVP" });
    if (event.ticketPriceNzd) {
      return res.status(402).json({ error: "This event requires a ticket", requiresTicket: true, eventId: event.id });
    }
    await storage.rsvpEvent(req.params.eventId, userId);
    res.json({ success: true });
  });

  app.delete("/api/events/:eventId/rsvp", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    await storage.unrsvpEvent(req.params.eventId, userId);
    res.json({ success: true });
  });

  app.get("/api/events/upcoming", async (req, res) => {
    const userId = req.session?.userId ?? undefined;
    const events = await storage.getUpcomingEvents(userId);
    res.json(events);
  });

  app.get("/api/events/public", async (req, res) => {
    const events = await storage.getPublicEventAds();
    res.json(events.map(toPublicAd));
  });

  app.get("/api/events/:eventId/attendees", async (req, res) => {
    const authUserId = await authenticateRequest(req);
    if (!authUserId) return res.status(401).json({ message: "Not authenticated" });
    const event = await storage.getGroupEvent(req.params.eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });
    const member = await storage.getGroupMember(event.groupId, authUserId);
    if (!member || member.status !== "approved") return res.status(403).json({ message: "You must be an approved group member to view attendees" });
    const attendees = await storage.getEventAttendees(req.params.eventId);
    res.json(attendees);
  });

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
      const { Pool } = await import("pg");
      const pool = new Pool(pgConnectConfig(process.env.DATABASE_URL));
      await pool.query(
        `INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [sessionUserId, req.params.id]
      );
      await pool.end();
      res.json({ blocked: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/users/:id/block", async (req, res) => {
    const sessionUserId = req.session?.userId;
    if (!sessionUserId) return res.status(401).json({ error: "Unauthorised" });
    try {
      const { Pool } = await import("pg");
      const pool = new Pool(pgConnectConfig(process.env.DATABASE_URL));
      await pool.query(
        `DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`,
        [sessionUserId, req.params.id]
      );
      await pool.end();
      res.json({ blocked: false });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/me/blocks", async (req, res) => {
    const sessionUserId = req.session?.userId;
    if (!sessionUserId) return res.status(401).json({ error: "Unauthorised" });
    try {
      const { Pool } = await import("pg");
      const pool = new Pool(pgConnectConfig(process.env.DATABASE_URL));
      const { rows } = await pool.query(
        `SELECT blocked_id FROM blocks WHERE blocker_id = $1`,
        [sessionUserId]
      );
      await pool.end();
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
      const { Pool } = await import("pg");
      const pool = new Pool(pgConnectConfig(process.env.DATABASE_URL));
      await pool.query(
        `INSERT INTO reports (reporter_id, reported_id, reason, detail) VALUES ($1, $2, $3, $4)`,
        [sessionUserId, req.params.id, reason, detail || null]
      );
      await pool.end();
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
      const { Pool } = await import("pg");
      const pool = new Pool(pgConnectConfig(process.env.DATABASE_URL));
      const { rows } = await pool.query(
        `SELECT sc.contact_user_id as id, u.name, u.avatar_url, u.identity_verified
         FROM safety_contacts sc
         JOIN users u ON u.id = sc.contact_user_id
         WHERE sc.user_id = $1
         ORDER BY sc.created_at DESC`,
        [userId]
      );
      await pool.end();
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/safety/eligible-contacts", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    try {
      const { Pool } = await import("pg");
      const pool = new Pool(pgConnectConfig(process.env.DATABASE_URL));
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
      await pool.end();
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/safety/contacts/:contactId", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const { contactId } = req.params;
    if (contactId === userId) return res.status(400).json({ error: "Cannot add yourself" });
    try {
      const { Pool } = await import("pg");
      const pool = new Pool(pgConnectConfig(process.env.DATABASE_URL));
      const { rows: u } = await pool.query("SELECT id FROM users WHERE id = $1", [contactId]);
      if (!u.length) { await pool.end(); return res.status(404).json({ error: "User not found" }); }
      await pool.query(
        `INSERT INTO safety_contacts (user_id, contact_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, contactId]
      );
      await pool.end();
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/safety/contacts/:contactId", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    try {
      const { Pool } = await import("pg");
      const pool = new Pool(pgConnectConfig(process.env.DATABASE_URL));
      await pool.query("DELETE FROM safety_contacts WHERE user_id = $1 AND contact_user_id = $2", [userId, req.params.contactId]);
      await pool.end();
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/safety/checkins", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    try {
      const { Pool } = await import("pg");
      const pool = new Pool(pgConnectConfig(process.env.DATABASE_URL));
      const { rows } = await pool.query(
        `SELECT * FROM safety_checkins WHERE user_id = $1 ORDER BY scheduled_at DESC LIMIT 20`,
        [userId]
      );
      await pool.end();
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
      const { Pool } = await import("pg");
      const pool = new Pool(pgConnectConfig(process.env.DATABASE_URL));
      const { rows } = await pool.query(
        `INSERT INTO safety_checkins (user_id, scheduled_at, place, meeting_with) VALUES ($1,$2,$3,$4) RETURNING *`,
        [userId, scheduled.toISOString(), place || null, meetingWith || null]
      );
      await pool.end();
      res.json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/safety/checkin/:id/confirm", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    try {
      const { Pool } = await import("pg");
      const pool = new Pool(pgConnectConfig(process.env.DATABASE_URL));
      const { rows } = await pool.query(
        `UPDATE safety_checkins SET confirmed_at = now()
         WHERE id = $1 AND user_id = $2 AND confirmed_at IS NULL AND cancelled_at IS NULL RETURNING *`,
        [req.params.id, userId]
      );
      await pool.end();
      if (!rows.length) return res.status(404).json({ error: "Check-in not found or already confirmed" });
      res.json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/safety/checkin/:id", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    try {
      const { Pool } = await import("pg");
      const pool = new Pool(pgConnectConfig(process.env.DATABASE_URL));
      await pool.query(
        `UPDATE safety_checkins SET cancelled_at = now() WHERE id = $1 AND user_id = $2`,
        [req.params.id, userId]
      );
      await pool.end();
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/safety/alert", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    const { place } = req.body;
    try {
      const { Pool } = await import("pg");
      const pool = new Pool(pgConnectConfig(process.env.DATABASE_URL));
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
      await pool.end();
      console.log(`[safety] SOS fired by ${userId}, ${contacts.length} contacts alerted`);
      res.json({ ok: true, contactsAlerted: contacts.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Open to roaming toggle ───────────────────────────────────────────────

  app.patch("/api/users/:id/open-to-roaming", async (req, res) => {
    const sessionUserId = req.session?.userId;
    if (!sessionUserId || sessionUserId !== req.params.id) return res.status(401).json({ error: "Unauthorised" });
    const { openToRoaming } = req.body;
    const updated = await storage.updateUser(req.params.id, { openToRoaming: !!openToRoaming });
    res.json({ openToRoaming: updated?.openToRoaming });
  });

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
      const { Pool } = await import("pg");
      const pool = new Pool(pgConnectConfig(process.env.DATABASE_URL));
      await pool.query(
        "INSERT INTO feedback (user_id, user_name, user_email, message, page) VALUES ($1,$2,$3,$4,$5)",
        [userId || null, userName, userEmail, message.trim(), page || null]
      );
      await pool.end();
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
      const { Pool } = await import("pg");
      const pool = new Pool(pgConnectConfig(process.env.DATABASE_URL));
      const { rows } = await pool.query("SELECT * FROM feedback ORDER BY created_at DESC LIMIT 200");
      await pool.end();
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
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
          sender: sender ? { id: sender.id, name: sender.name, avatarUrl: sender.avatarUrl } : null,
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

  return httpServer;
}
