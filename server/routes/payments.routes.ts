import type { Express } from "express";
import { storage } from "../storage";
import { getUncachableStripeClient } from "../stripeClient";
import { supabaseAdmin } from "../supabaseAdmin";
import { authenticateRequest } from "../http-helpers";
import type { RouteDeps } from "./deps";

// Payments: Stripe checkout/boost/organiser, Connect, event tickets, billing portal,
// payment + identity webhooks, account deletion, and ID verification.
export function registerPaymentRoutes(app: Express, deps: RouteDeps) {
  const { checkoutLimiter, verifyLimiter } = deps;
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

      // Delete the Supabase auth login too. The app user id ≠ the auth user id
      // (they're mapped by email), so deleting by the app id silently no-ops and
      // leaves the login alive — the user could "log in" again and re-provision a
      // fresh profile. Resolve the REAL auth id (from the Bearer token, else by
      // email) before deleting.
      try {
        let authUserId: string | undefined;
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
          const { data } = await supabaseAdmin.auth.getUser(authHeader.slice(7));
          authUserId = data?.user?.id;
        }
        if (!authUserId && user.email) {
          const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
          authUserId = data.users.find(u => (u.email || "").toLowerCase() === user.email.toLowerCase())?.id;
        }
        if (authUserId) await supabaseAdmin.auth.admin.deleteUser(authUserId);
        else console.warn("[account-delete] could not resolve auth user id for", user.email);
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
        // Keep the session id (not null) so /api/verify/status can report the
        // requires_input state + reason and the UI can offer a clear retry,
        // instead of silently dropping the user back to the start with no hint.
        await storage.updateUserVerification(userId, session.id, false);
      }
    }

    return res.json({ received: true });
  });
}
