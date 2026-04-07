import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { Server as SocketServer } from "socket.io";
import { storage } from "./storage";
import { signupSchema } from "@shared/schema";
import { hashPassword, comparePassword } from "./auth";
import { buildFingerprint, computeOverlap, detectAlmostMet, computeHonestyTier } from "./fingerprint";
import { getUncachableStripeClient } from "./stripeClient";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import { supabaseAdmin } from "./supabaseAdmin";
import { hashAdminPassword, compareAdminPassword, isAdminAuthenticated, getAdminFromSession } from "./admin-auth";

const PgSessionStore = connectPgSimple(session);
const isProd = process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1";

// ---------------------------------------------------------------------------
// Rate limiting — in-memory per-IP buckets, configurable per endpoint.
// Each call to createRateLimiter() returns an independent middleware with
// its own counter store, so limits don't bleed between endpoints.
// ---------------------------------------------------------------------------
function createRateLimiter(maxRequests: number, windowMs: number, message?: string) {
  const store = new Map<string, { count: number; resetAt: number }>();
  const defaultMsg = `Too many requests. Please try again in ${Math.round(windowMs / 60000)} minutes.`;
  return function rateLimiter(req: Request, res: Response, next: NextFunction) {
    const key = req.ip || "unknown";
    const now = Date.now();
    const rec = store.get(key);
    if (rec && now < rec.resetAt) {
      if (rec.count >= maxRequests) {
        res.set("Retry-After", String(Math.ceil((rec.resetAt - now) / 1000)));
        return res.status(429).json({ message: message || defaultMsg });
      }
      rec.count++;
    } else {
      store.set(key, { count: 1, resetAt: now + windowMs });
    }
    next();
  };
}

// 5 login attempts per 15 minutes — brute-force protection
const loginLimiter    = createRateLimiter(5,  15 * 60 * 1000, "Too many login attempts. Please try again in 15 minutes.");
// 3 admin login attempts per 30 minutes — stricter brute-force protection
const adminLoginLimiter = createRateLimiter(3, 30 * 60 * 1000, "Too many admin login attempts. Please try again in 30 minutes.");
// 10 signups per hour — prevents account farming
const signupLimiter   = createRateLimiter(10, 60 * 60 * 1000, "Too many sign-up attempts. Please try again later.");
// 10 OAuth profile creations per hour
const profileLimiter  = createRateLimiter(10, 60 * 60 * 1000);
// 3 identity verification starts per hour — Stripe sessions are expensive
const verifyLimiter   = createRateLimiter(3,  60 * 60 * 1000, "Too many verification attempts. Please try again in an hour.");
// 30 photo uploads per hour
const uploadLimiter   = createRateLimiter(30, 60 * 60 * 1000);

async function authenticateRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && user?.email) {
        const dbUser = await storage.getUserByEmail(user.email);
        if (dbUser) return dbUser.id;
      }
    } catch { /* fall through to session */ }
  }
  return (req.session as any)?.userId || null;
}

const DATA_DELETION_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Data Deletion — roam.</title>
<style>
  body{font-family:Georgia,serif;background:#0e1a0e;color:#e8e0cc;max-width:680px;margin:60px auto;padding:0 24px;line-height:1.7}
  h1{font-size:28px;margin-bottom:4px}
  h1 span{color:#c8e64a}
  .sub{font-family:monospace;font-size:11px;letter-spacing:.1em;color:rgba(232,224,204,.35);margin-bottom:40px}
  h2{font-family:monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#c8e64a;margin-top:32px;margin-bottom:10px}
  p,li{font-size:13px;color:rgba(232,224,204,.65)}
  ul{padding-left:20px}
  a{color:#c8e64a}
  .card{border:1px solid rgba(232,224,204,.1);border-radius:14px;padding:20px 24px;margin-top:10px}
</style>
</head>
<body>
<h1>Data <span>Deletion</span></h1>
<div class="sub">Swiperight Apps Aotearoa &middot; letsroam.life</div>

<h2>Option 1 &mdash; Delete from inside the app</h2>
<div class="card">
  <ul>
    <li>Open roam. and sign in</li>
    <li>Go to your Profile (bottom right icon)</li>
    <li>Scroll to the bottom and tap <strong>Delete my account and all data</strong></li>
    <li>Confirm in the dialog &mdash; deletion is immediate and permanent</li>
  </ul>
</div>

<h2>Option 2 &mdash; Email us</h2>
<div class="card">
  <p>Email <a href="mailto:privacy@letsroam.life">privacy@letsroam.life</a> with the subject line <strong>Delete my data</strong> and include the email address linked to your account. We will delete your data within 30 days and send confirmation.</p>
</div>

<h2>What gets deleted</h2>
<div class="card">
  <ul>
    <li>Your profile, name, bio, and location</li>
    <li>All photos you uploaded</li>
    <li>Your Adventure Fingerprint and bucket list</li>
    <li>All matches and messages</li>
    <li>Your Adventurer subscription (cancelled immediately)</li>
    <li>Your authentication record</li>
  </ul>
</div>

<h2>Retention</h2>
<div class="card">
  <p>We retain minimal records required by law (e.g. payment receipts from Stripe) for up to 7 years. These records do not include your profile or personal communications.</p>
</div>
</body>
</html>`;

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
  // Facebook sends a signed_request; we return a confirmation code + status URL.
  app.post("/api/facebook/data-deletion", (req, res) => {
    const { signed_request } = req.body || {};
    const confirmationCode = `roam-del-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log("[facebook-deletion] received callback, signed_request present:", !!signed_request);
    return res.json({
      url: `https://letsroam.life/data-deletion?confirmation=${confirmationCode}`,
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

  io.on("connection", (socket) => {
    socket.on("join_match", (matchId: string) => {
      socket.join(`match:${matchId}`);
    });

    socket.on("send_message", async (data: { matchId: string; senderId: string; content: string; tempId?: string }) => {
      try {
        const msg = await storage.createMessage({
          matchId: data.matchId,
          senderId: data.senderId,
          content: data.content,
        });
        io.to(`match:${data.matchId}`).emit("new_message", { ...msg, tempId: data.tempId });
      } catch (err: any) {
        socket.emit("message_error", { tempId: data.tempId, error: err.message });
      }
    });
  });
  // Ensure the Supabase Storage bucket exists (idempotent — no-op if already present)
  await supabaseAdmin.storage.createBucket("photos", { public: true }).catch(() => {});


  const sessionPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  app.set("trust proxy", 1);
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

  app.post("/api/auth/signup", signupLimiter, async (req, res) => {
    try {
      const parsed = signupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid data" });
      }

      const existing = await storage.getUserByEmail(parsed.data.email);
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      const hashedPassword = await hashPassword(parsed.data.password);

      // Create in Supabase so the user can log in via Supabase auth later.
      // email_confirm: true skips the confirmation email since we handle
      // verification ourselves via the signup flow.
      try {
        await supabaseAdmin.auth.admin.createUser({
          email: parsed.data.email,
          password: parsed.data.password,
          email_confirm: true,
        });
      } catch (sbErr: any) {
        // "User already registered" is fine — just means they're already in Supabase
        if (!sbErr.message?.toLowerCase().includes("already")) {
          console.warn("[signup] Supabase user creation failed:", sbErr.message);
        }
      }

      const user = await storage.createUser({
        name: parsed.data.name,
        email: parsed.data.email,
        password: hashedPassword,
        dob: parsed.data.dob,
        gender: parsed.data.gender,
        ethnicity: parsed.data.ethnicity,
        location: parsed.data.location,
        tagline: parsed.data.tagline,
        tier: parsed.data.tier,
        photoLicenseAgreed: parsed.data.photoLicenseAgreed,
      });

      (req.session as any).userId = user.id;

      const { password: _, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Server error" });
    }
  });

  app.post("/api/auth/login", loginLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
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

      const newUser = await storage.createUser({
        name,
        email: sbUser.email,
        password: "SUPABASE_AUTH",
        dob: dob || null,
        gender: gender || null,
        ethnicity: ethnicity || null,
        location: location || null,
        tagline: tagline || null,
        tier: tier || "free",
        photoLicenseAgreed: !!photoLicenseAgreed,
      });

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

  app.patch("/api/users/:id", async (req, res) => {
    const sessionUserId = await authenticateRequest(req);
    if (!sessionUserId || sessionUserId !== req.params.id) {
      return res.status(401).json({ message: "Not authorized" });
    }
    try {
      const { name, tagline, location, avatarUrl, adventureTags } = req.body;
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
      await storage.deleteBucketItem(req.params.id);
      res.json({ message: "Deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/users/:id/photos", async (req, res) => {
    const photos = await storage.getPhotosByUser(req.params.id);
    res.json(photos);
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
      if (userId !== authUserId) {
        return res.status(403).json({ message: "Cannot upload photos for another user" });
      }

      const MAX_SIZE = 8 * 1024 * 1024;
      if (dataUrl.length > MAX_SIZE * 1.37) {
        return res.status(413).json({ message: "Image too large. Please use a photo under 8 MB." });
      }

      const matches = dataUrl.match(/^data:image\/(jpeg|jpg|png|webp|gif);base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({ message: "Invalid image format. Use JPEG, PNG, or WebP." });
      }

      const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
      const mimeType = `image/${matches[1]}`;
      const base64Data = matches[2];
      const storagePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const fileBuffer = Buffer.from(base64Data, "base64");

      const { error: uploadError } = await supabaseAdmin.storage
        .from("photos")
        .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: false });

      if (uploadError) {
        return res.status(500).json({ message: `Storage error: ${uploadError.message}` });
      }

      const { data: urlData } = supabaseAdmin.storage.from("photos").getPublicUrl(storagePath);
      const storageUrl = urlData.publicUrl;
      const photo = await storage.createPhoto({
        userId,
        storageUrl,
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
    try {
      const { userAId, userBId, status } = req.body;
      if (!userAId || !userBId) return res.status(400).json({ message: "userAId and userBId are required" });

      // Block matches involving demo profiles — they are display-only placeholders
      if (String(userAId).startsWith("demo-") || String(userBId).startsWith("demo-")) {
        return res.json({ isNewMatch: false, demo: true });
      }

      const existing = await storage.getMatchBetween(userAId, userBId);
      if (existing) {
        if (
          (existing.status === "liked_b" && existing.userBId === userAId) ||
          (existing.status === "liked_a" && existing.userAId === userBId)
        ) {
          const updated = await storage.updateMatchStatus(existing.id, "matched", { matchedAt: new Date() });
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
    const msgs = await storage.getMessagesByMatch(req.params.matchId);
    res.json(msgs);
  });

  app.post("/api/messages", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    if (req.body.senderId && req.body.senderId !== userId) {
      return res.status(403).json({ message: "Cannot send messages as another user" });
    }
    try {
      const msg = await storage.createMessage(req.body);
      res.status(201).json(msg);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/bucket-list/:userId", async (req, res) => {
    const items = await storage.getBucketListByUser(req.params.userId);
    res.json(items);
  });

  app.post("/api/bucket-list", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const item = await storage.createBucketItem({ ...req.body, userId });
      res.status(201).json(item);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // Stripe Hosted Checkout — Adventurer subscription ($12 NZD/month)
  // ---------------------------------------------------------------------------
  const checkoutLimiter = createRateLimiter(5, 60 * 60 * 1000);

  app.post("/api/checkout/start", checkoutLimiter, async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const stripe = await getUncachableStripeClient();
      const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000";
      const baseUrl = domain.startsWith("localhost") ? `http://${domain}` : `https://${domain}`;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: user.stripeCustomerId ? undefined : user.email,
        customer: user.stripeCustomerId || undefined,
        line_items: [{
          price_data: {
            currency: "nzd",
            product_data: {
              name: "roam. Adventurer",
              description: "Unlimited matches · Full messaging · Almost Met radar · Bucket List matching",
              images: [],
            },
            unit_amount: 1200,
            recurring: { interval: "month" },
          },
          quantity: 1,
        }],
        success_url: `${baseUrl}/profile?upgraded=1`,
        cancel_url: `${baseUrl}/profile`,
        metadata: { userId },
        allow_promotion_codes: true,
      });

      return res.json({ url: session.url });
    } catch (err: any) {
      console.error("[checkout] Error:", err.message);
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
      const stripe = await getUncachableStripeClient();
      const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000";
      const baseUrl = domain.startsWith("localhost") ? `http://${domain}` : `https://${domain}`;
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
      const stripe = await getUncachableStripeClient();
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
    return res.json(ad);
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
    const { tier } = req.body;
    if (tier && !["free", "adventurer", "contributor"].includes(tier)) {
      return res.status(400).json({ message: "Invalid tier" });
    }
    const updated = await storage.updateUser(req.params.id, { ...(tier ? { tier } : {}) });
    if (!updated) return res.status(404).json({ message: "User not found" });
    const { password: _, ...safe } = updated;
    console.log(`[admin] User ${req.params.id} tier changed to ${tier}`);
    return res.json(safe);
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    if (!(await isAdminAuthenticated(req))) {
      return res.status(401).json({ message: "Admin authentication required" });
    }
    const target = await storage.getUser(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found" });
    try {
      const { data: sbUser } = await supabaseAdmin.auth.admin.listUsers();
      const match = sbUser?.users?.find((u: any) => u.email === target.email);
      if (match) await supabaseAdmin.auth.admin.deleteUser(match.id);
    } catch { /* non-fatal */ }
    await storage.deleteUser(req.params.id);
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
    try {
      await storage.deleteGroup(req.params.id);
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
    const updated = await storage.updateAd(ad.id, { status: "approved", reviewedAt: new Date(), expiresAt, rejectionReason: null });
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
    const { reason } = req.body;
    const updated = await storage.updateAd(req.params.id, { status: "rejected", reviewedAt: new Date(), rejectionReason: reason || "Does not meet content guidelines" });
    console.log(`[ads] Admin rejected ad ${req.params.id}: ${reason}`);
    return res.json(updated);
  });

  // ─────────────────────────────────────────────────────────────────────────

  app.post("/api/stripe/payment-webhook", async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_PAYMENT_WEBHOOK_SECRET;
    let event: any;
    try {
      const stripe = await getUncachableStripeClient();
      if (webhookSecret && sig) {
        event = stripe.webhooks.constructEvent(req.rawBody as Buffer, sig, webhookSecret);
      } else {
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
        const allUsers = await storage.getAllUsers();
        const user = allUsers.find(u => u.stripeCustomerId === customerId);
        if (user) {
          await storage.updateUser(user.id, { tier: "free", stripeSubscriptionId: null });
          console.log(`[payment] User ${user.id} downgraded to free (subscription cancelled)`);
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

      const stripe = await getUncachableStripeClient();
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

      console.log(`[account-delete] User ${userId} (${user.email}) deleted their account`);
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
      const stripe = await getUncachableStripeClient();
      const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000";
      const baseUrl = domain.startsWith("localhost") ? `http://${domain}` : `https://${domain}`;

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

  app.post("/api/stripe/identity-webhook", async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET;

    let event: any;
    try {
      const stripe = await getUncachableStripeClient();
      if (webhookSecret && sig) {
        event = stripe.webhooks.constructEvent(
          req.rawBody as Buffer,
          sig,
          webhookSecret
        );
      } else {
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
    const checks = {
      tier: user.tier === "adventurer" || user.tier === "contributor",
      photo: hasApprovedPhoto,
      tagline: !!user.tagline,
      tags: tags.length >= 3,
    };
    if (!checks.tier) return { eligible: false, reason: "Adventurer or Contributor tier required", checks };
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
    const members = await storage.getGroupMembers(req.params.id);
    const enriched = await Promise.all(members.map(async m => {
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
    const { title, description, location, startAt, endAt } = req.body;
    if (!title || !startAt) return res.status(400).json({ error: "title and startAt are required" });
    const event = await storage.createGroupEvent({
      groupId: req.params.id,
      createdBy: userId,
      title,
      description: description ?? null,
      location: location ?? null,
      startAt: new Date(startAt),
      endAt: endAt ? new Date(endAt) : null,
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
    await storage.deleteGroupEvent(req.params.eventId);
    res.json({ success: true });
  });

  // ─── Event RSVP ───────────────────────────────────────────────────────────

  app.post("/api/events/:eventId/rsvp", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
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
    res.json(events);
  });

  app.get("/api/events/:eventId/attendees", async (req, res) => {
    const attendees = await storage.getEventAttendees(req.params.eventId);
    res.json(attendees);
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
    await storage.markNotificationRead(Number(req.params.id));
    res.json({ success: true });
  });

  app.patch("/api/notifications/read-all", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorised" });
    await storage.markAllNotificationsRead(userId);
    res.json({ success: true });
  });

  // ─── Extend Socket.io for group campsite chat ─────────────────────────────

  io.on("connection", (socket) => {
    socket.on("join_group", (groupId: string) => {
      socket.join(`group:${groupId}`);
    });

    socket.on("leave_group", (groupId: string) => {
      socket.leave(`group:${groupId}`);
    });

    socket.on("send_group_message", async (data: { groupId: string; senderId: string; content: string; tempId?: string }) => {
      try {
        const [member, msg] = await Promise.all([
          storage.getGroupMember(data.groupId, data.senderId),
          storage.createGroupMessage({ groupId: data.groupId, senderId: data.senderId, content: data.content }),
        ]);
        if (!member || member.status !== "approved") {
          socket.emit("group_message_error", { tempId: data.tempId, error: "Not a member of this group" });
          return;
        }
        const sender = await storage.getUser(data.senderId);
        io.to(`group:${data.groupId}`).emit("new_group_message", {
          ...msg,
          sender: sender ? { id: sender.id, name: sender.name, avatarUrl: sender.avatarUrl } : null,
          tempId: data.tempId,
        });
      } catch (err: any) {
        socket.emit("group_message_error", { tempId: data.tempId, error: err.message });
      }
    });
  });

  return httpServer;
}
