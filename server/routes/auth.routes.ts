import type { Express } from "express";
import { storage } from "../storage";
import { comparePassword } from "../auth";
import { supabaseAdmin } from "../supabaseAdmin";
import { authenticateRequest } from "../http-helpers";
import type { RouteDeps } from "./deps";

// User authentication: login, current user, profile, Supabase migration, logout.
export function registerAuthRoutes(app: Express, deps: RouteDeps) {
  const { loginLimiter, profileLimiter } = deps;
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
}
