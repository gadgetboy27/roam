import type { Express } from "express";
import { storage } from "../storage";
import { getUncachableStripeClient } from "../stripeClient";
import { toPublicAd, AD_TIERS, authenticateRequest } from "../http-helpers";

// Public advertising: submit (paid), live ads feed, click tracking.
export function registerAdsRoutes(app: Express) {
  // ─── Ad system ───────────────────────────────────────────────────────────

  app.post("/api/ads/submit", async (req, res) => {
    const { advertiserName, advertiserEmail, advertiserCompany, tier, headline, tagline, ctaText, ctaUrl, imageUrl, videoUrl, contentType, adType, linkedGroupId, linkedEventId, eventStartAt, eventLocation } = req.body;
    if (!advertiserName || !advertiserEmail || !tier || !headline) {
      return res.status(400).json({ message: "advertiserName, advertiserEmail, tier, and headline are required" });
    }
    const tierInfo = AD_TIERS[tier as string];
    if (!tierInfo) return res.status(400).json({ message: "Invalid tier. Must be explorer, trailblazer, or summit" });
    const submittedByUserId = (await authenticateRequest(req)) ?? undefined;

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
}
