import type { Request } from "express";
import pg from "pg";
import { storage } from "./storage";
import { supabaseAdmin } from "./supabaseAdmin";

// Ad pricing tiers (price in cents, duration in days). Shared by the ads
// submission route and the admin ad-approval route.
export const AD_TIERS: Record<string, { label: string; price: number; days: number }> = {
  explorer:    { label: "Explorer",    price: 4900,  days: 7  },
  trailblazer: { label: "Trailblazer", price: 12900, days: 14 },
  summit:      { label: "Summit",      price: 29900, days: 30 },
};

export function toPublicAd(ad: Record<string, any>) {
  return {
    id: ad.id,
    advertiserName: ad.advertiserName,
    advertiserCompany: ad.advertiserCompany,
    tier: ad.tier,
    headline: ad.headline,
    tagline: ad.tagline,
    ctaText: ad.ctaText,
    ctaUrl: ad.ctaUrl,
    imageUrl: ad.imageUrl,
    videoUrl: ad.videoUrl,
    contentType: ad.contentType,
    adType: ad.adType,
    eventStartAt: ad.eventStartAt,
    eventLocation: ad.eventLocation,
  };
}

// ---------------------------------------------------------------------------
// PostgreSQL-backed rate-limit store for express-rate-limit.
// Uses the same Postgres pool as sessions so no extra connections are needed.
// Falls open on DB errors to avoid blocking legitimate users during transient failures.
// ---------------------------------------------------------------------------
export class PgRateLimitStore {
  constructor(private pool: pg.Pool, private windowMs: number, private prefix: string) {}

  async increment(key: string) {
    const fkey = `${this.prefix}:${key}`;
    const resetAt = new Date(Date.now() + this.windowMs);
    try {
      const result = await this.pool.query(`
        INSERT INTO rate_limits (key, count, reset_at)
        VALUES ($1, 1, $2)
        ON CONFLICT (key) DO UPDATE
          SET count    = CASE WHEN rate_limits.reset_at > NOW() THEN rate_limits.count + 1 ELSE 1 END,
              reset_at = CASE WHEN rate_limits.reset_at > NOW() THEN rate_limits.reset_at   ELSE $2 END
        RETURNING count, reset_at
      `, [fkey, resetAt]);
      return { totalHits: result.rows[0].count as number, resetTime: new Date(result.rows[0].reset_at) as Date };
    } catch {
      return { totalHits: 1, resetTime: resetAt };
    }
  }

  async decrement(key: string) {
    const fkey = `${this.prefix}:${key}`;
    await this.pool.query("UPDATE rate_limits SET count = GREATEST(0, count - 1) WHERE key = $1", [fkey]).catch(() => {});
  }

  async resetKey(key: string) {
    const fkey = `${this.prefix}:${key}`;
    await this.pool.query("DELETE FROM rate_limits WHERE key = $1", [fkey]).catch(() => {});
  }

  async resetAll() {
    await this.pool.query("DELETE FROM rate_limits WHERE key LIKE $1", [`${this.prefix}:%`]).catch(() => {});
  }
}

export async function authenticateRequest(req: Request): Promise<string | null> {
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

export function messagePreview(content: string): string {
  const c = content.trim();
  return c.length > 80 ? c.slice(0, 77) + "…" : c;
}

// Shared image-upload pipeline: validates a base64 data URL, writes it to the
// "photos" storage bucket (optionally under a sub-prefix), and returns the
// public URL. Used by both adventure-photo and dream-destination uploads so the
// validation rules stay in one place.
export type ImageUploadResult = { ok: true; url: string } | { ok: false; status: number; message: string };

export async function uploadImageDataUrl(userId: string, dataUrl: unknown, prefix = ""): Promise<ImageUploadResult> {
  if (!dataUrl || typeof dataUrl !== "string") return { ok: false, status: 400, message: "dataUrl required" };

  const MAX_SIZE = 8 * 1024 * 1024;
  if (dataUrl.length > MAX_SIZE * 1.37) {
    return { ok: false, status: 413, message: "Image too large. Please use a photo under 8 MB." };
  }
  const m = dataUrl.match(/^data:image\/(jpeg|jpg|png|webp|gif);base64,(.+)$/);
  if (!m) return { ok: false, status: 400, message: "Invalid image format. Use JPEG, PNG, or WebP." };

  const ext = m[1] === "jpeg" ? "jpg" : m[1];
  const mimeType = `image/${m[1]}`;
  const dir = prefix ? `${userId}/${prefix}` : userId;
  const storagePath = `${dir}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const fileBuffer = Buffer.from(m[2], "base64");

  const { error } = await supabaseAdmin.storage
    .from("photos")
    .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: false });
  if (error) return { ok: false, status: 500, message: `Storage error: ${error.message}` };

  const { data } = supabaseAdmin.storage.from("photos").getPublicUrl(storagePath);
  return { ok: true, url: data.publicUrl };
}

// Create a "new message" notification for the recipient of a 1:1 match, so the
// notification bell alerts them even when they don't have the chat open.
// Deduped: skips if the recipient already has an unread message notification for
// this match, so a burst of messages produces one alert rather than many.
export async function notifyNewMessage(
  match: { id: string; userAId: string; userBId: string },
  senderId: string,
  content: string,
): Promise<void> {
  const recipientId = match.userAId === senderId ? match.userBId : match.userAId;
  if (!recipientId || recipientId === senderId) return;
  const existing = await storage.findUnreadNotification(recipientId, "message", "matchId", match.id);
  if (existing) return;
  const sender = await storage.getUser(senderId);
  await storage.createNotification({
    userId: recipientId,
    type: "message",
    title: sender?.name ? `New message from ${sender.name}` : "New message",
    body: messagePreview(content),
    data: JSON.stringify({ matchId: match.id }),
  });
}

// Notify every approved group member except the sender that a new campsite
// message arrived. Deduped per member per group so an active conversation
// produces one unread alert each, not one per message.
export async function notifyGroupMessage(
  groupId: string,
  senderId: string,
  senderName: string,
  content: string,
): Promise<void> {
  const [members, group] = await Promise.all([
    storage.getGroupMembers(groupId),
    storage.getGroup(groupId),
  ]);
  const groupName = group?.name ?? "your group";
  const preview = messagePreview(content);
  await Promise.all(members
    .filter(m => m.status === "approved" && m.userId !== senderId)
    .map(async (m) => {
      const existing = await storage.findUnreadNotification(m.userId, "group_message", "groupId", groupId);
      if (existing) return;
      await storage.createNotification({
        userId: m.userId,
        type: "group_message",
        title: `New message in ${groupName}`,
        body: `${senderName}: ${preview}`,
        data: JSON.stringify({ groupId }),
      });
    }));
}

export const DATA_DELETION_HTML = `<!DOCTYPE html>
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
