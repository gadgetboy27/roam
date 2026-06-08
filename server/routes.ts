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
import { setupSockets } from "./sockets";
import { registerGroupRoutes } from "./routes/groups.routes";
import { registerSafetyRoutes } from "./routes/safety.routes";
import { registerMiscRoutes } from "./routes/misc.routes";
import { registerAuthRoutes } from "./routes/auth.routes";
import { registerCoreRoutes } from "./routes/core.routes";
import { registerAdminRoutes } from "./routes/admin.routes";
import { registerPaymentRoutes } from "./routes/payments.routes";
import { registerAdsRoutes } from "./routes/ads.routes";
import type { RouteDeps } from "./routes/deps";

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

  // Socket auth + 1:1 and group chat handlers (see server/sockets.ts)
  setupSockets(io);

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
  const checkoutLimiter = makeLimiter(5, 60 * 60 * 1000);

  // Shared runtime deps passed to route modules that need limiters / io.
  const deps: RouteDeps = {
    loginLimiter, adminLoginLimiter, profileLimiter, verifyLimiter, uploadLimiter, checkoutLimiter, io,
  };

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

  // ─── User auth: login, me, profile, migrate, logout (see routes/auth.routes.ts)
  registerAuthRoutes(app, deps);


  // ─── Core app: users, discover, matches, messages, photos, bucket-list (see routes/core.routes.ts)
  registerCoreRoutes(app, deps);

  // ─── Admin console: auth, accounts, moderation, ad review, audit (see routes/admin.routes.ts)
  registerAdminRoutes(app, deps);

  // ─── Payments: checkout, Stripe Connect, webhooks, verify, account delete (see routes/payments.routes.ts)
  registerPaymentRoutes(app, deps);

  // ─── Ads: submit, live feed, click tracking (see routes/ads.routes.ts)
  registerAdsRoutes(app);

  // ─── Groups, members, campsite, events, invites, RSVP (see routes/groups.routes.ts)
  registerGroupRoutes(app);

  // ─── Safety: mode, blocking, reporting, contacts/check-ins/SOS (see routes/safety.routes.ts)
  registerSafetyRoutes(app);

  // ─── Open to roaming toggle ───────────────────────────────────────────────

  app.patch("/api/users/:id/open-to-roaming", async (req, res) => {
    const sessionUserId = req.session?.userId;
    if (!sessionUserId || sessionUserId !== req.params.id) return res.status(401).json({ error: "Unauthorised" });
    const { openToRoaming } = req.body;
    const updated = await storage.updateUser(req.params.id, { openToRoaming: !!openToRoaming });
    res.json({ openToRoaming: updated?.openToRoaming });
  });

  // ─── Notifications + feedback (see routes/misc.routes.ts)
  registerMiscRoutes(app);

  return httpServer;
}
