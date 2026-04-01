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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const io = new SocketServer(httpServer, {
    path: "/socket.io",
    cors: { origin: "*", methods: ["GET", "POST"] },
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

  app.get("/api/users", async (req, res) => {
    const userId = await authenticateRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const allUsers = await storage.getAllUsers();
    const safe = allUsers.map(({ password: _, ...u }) => u);
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

  return httpServer;
}
