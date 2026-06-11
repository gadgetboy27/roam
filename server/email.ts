// Shared branded email template + sender for all app (Resend) emails.
// One place for roam's logo, colours and layout so every email looks the same.
// (Supabase auth emails — signup confirm / password reset — are configured
// separately in the Supabase dashboard, not here.)

const FROM = "roam <noreply@letsroam.life>";
const LOGO = "https://letsroam.life/roam-logo-wide.png";

export interface BrandedEmailOpts {
  greeting?: string;     // e.g. "Hi Chanel,"
  bodyHtml: string;      // inner paragraph HTML
  ctaText?: string;      // e.g. "Accept invite →"
  ctaUrl?: string;
  footerNote?: string;   // small print above the roam footer line
}

export function brandedEmail(o: BrandedEmailOpts): string {
  const greeting = o.greeting
    ? `<p style="color:#f2ede3;font-size:15px;line-height:1.6;margin:14px 0 0;">${o.greeting}</p>`
    : "";
  const cta = o.ctaText && o.ctaUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;"><tr><td style="border-radius:12px;background:#b6ff3a;">
            <a href="${o.ctaUrl}" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:700;color:#0e1a0d;text-decoration:none;">${o.ctaText}</a>
          </td></tr></table>`
    : "";
  const footer = o.footerNote ?? "You're receiving this because you have a roam account.";
  return `<body style="margin:0;background:#0e1a0d;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e1a0d;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#13211a;border:1px solid rgba(242,237,227,0.10);border-radius:20px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
        <tr><td style="padding:26px 28px 6px;">
          <img src="${LOGO}" alt="roam." width="150" style="display:block;width:150px;height:auto;border:0;border-radius:8px;" />
        </td></tr>
        <tr><td style="padding:8px 28px 24px;">
          ${greeting}
          ${o.bodyHtml}
          ${cta}
        </td></tr>
        <tr><td style="padding:16px 28px 24px;border-top:1px solid rgba(242,237,227,0.08);">
          <p style="color:rgba(242,237,227,0.32);font-size:11px;line-height:1.6;margin:0;">${footer}<br>roam &middot; letsroam.life &middot; Aotearoa New Zealand</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>`;
}

// A standard branded paragraph (keeps copy consistent across emails).
export function emailParagraph(html: string): string {
  return `<p style="color:rgba(242,237,227,0.72);font-size:14px;line-height:1.65;margin:14px 0 0;">${html}</p>`;
}

export async function sendEmail(opts: {
  to: string | string[]; subject: string; html: string; text?: string; replyTo?: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn("[email] RESEND_API_KEY not set — skipping send"); return false; }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      replyTo: opts.replyTo,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (error) { console.warn("[email] send failed:", JSON.stringify(error)); return false; }
    return true;
  } catch (e: any) {
    console.warn("[email] send error:", e?.message || e);
    return false;
  }
}
