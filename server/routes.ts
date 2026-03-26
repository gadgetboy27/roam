import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { Server as SocketServer } from "socket.io";
import { storage } from "./storage";
import { signupSchema } from "@shared/schema";
import { hashPassword, comparePassword } from "./auth";
import { buildFingerprint, computeOverlap, detectAlmostMet, computeHonestyTier } from "./fingerprint";
import { getUncachableStripeClient } from "./stripeClient";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";

const PgSessionStore = connectPgSimple(session);
const isProd = process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1";

const authAttempts = new Map<string, { count: number; resetAt: number }>();
function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || "unknown";
  const now = Date.now();
  const rec = authAttempts.get(key);
  if (rec && now < rec.resetAt) {
    if (rec.count >= 10) {
      return res.status(429).json({ message: "Too many attempts. Please try again in 15 minutes." });
    }
    rec.count++;
  } else {
    authAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
  }
  next();
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
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }

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

  app.post("/api/auth/signup", rateLimit, async (req, res) => {
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

  app.post("/api/auth/login", rateLimit, async (req, res) => {
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
    const userId = (req.session as any)?.userId;
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

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/users", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const allUsers = await storage.getAllUsers();
    const safe = allUsers.map(({ password: _, ...u }) => u);
    res.json(safe);
  });

  app.patch("/api/users/:id", async (req, res) => {
    const sessionUserId = (req.session as any)?.userId;
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

  app.post("/api/photos", async (req, res) => {
    try {
      const photo = await storage.createPhoto(req.body);
      res.status(201).json(photo);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/upload", async (req, res) => {
    try {
      const { dataUrl, filename, userId, caption, displayOrder } = req.body;
      if (!dataUrl || !filename || !userId) {
        return res.status(400).json({ message: "dataUrl, filename, userId required" });
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
      const base64Data = matches[2];
      const safeFilename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const filePath = path.join(uploadsDir, safeFilename);

      await writeFile(filePath, Buffer.from(base64Data, "base64"));

      const storageUrl = `/uploads/${safeFilename}`;
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
    const userId = (req.session as any)?.userId;
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
    const { status } = req.body;
    const updated = await storage.updateMatchStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ message: "Match not found" });
    res.json(updated);
  });

  app.get("/api/matches/:matchId/messages", async (req, res) => {
    const msgs = await storage.getMessagesByMatch(req.params.matchId);
    res.json(msgs);
  });

  app.post("/api/messages", async (req, res) => {
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
    try {
      const item = await storage.createBucketItem(req.body);
      res.status(201).json(item);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/verify/start", async (req, res) => {
    const userId = (req.session as any)?.userId;
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
      }
    }

    return res.json({ received: true });
  });

  return httpServer;
}
