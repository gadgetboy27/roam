import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketServer } from "socket.io";
import { storage } from "./storage";
import { signupSchema } from "@shared/schema";
import { hashPassword, comparePassword } from "./auth";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import session from "express-session";
import MemoryStore from "memorystore";

const SessionStore = MemoryStore(session);

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

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "roam-dev-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, maxAge: 30 * 24 * 60 * 60 * 1000 },
      store: new SessionStore({ checkPeriod: 86400000 }),
    })
  );

  app.post("/api/auth/signup", async (req, res) => {
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

  app.post("/api/auth/login", async (req, res) => {
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

  app.get("/api/users", async (_req, res) => {
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
      const match = await storage.createMatch(req.body);
      res.status(201).json(match);
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

  return httpServer;
}
