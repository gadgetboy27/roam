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

  // ─── Core app: users, discover, matches, messages, photos, bucket-list (see routes/core.routes.ts)
  registerCoreRoutes(app, deps);

  // ---------------------------------------------------------------------------
  // Stripe Hosted Checkout — Adventurer subscription ($4.99 NZD/month)
  // (checkoutLimiter is created with the other limiters near the top)
  // ---------------------------------------------------------------------------

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
