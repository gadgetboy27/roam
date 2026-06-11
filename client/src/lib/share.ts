// Tier-1 social sharing: native share sheet + platform share-intent links.
// No OAuth, no stored tokens, no API permissions — it rides the user's existing
// logged-in social apps. The only safe + seamless way to share to personal feeds.

export type SharePayload = { url: string; text: string; title?: string };

export function nativeShare(p: SharePayload): boolean {
  const n: any = navigator;
  if (typeof n.share === "function") {
    n.share({ title: p.title, text: p.text, url: p.url }).catch(() => {});
    return true;
  }
  return false;
}

export function canNativeShare(): boolean {
  return typeof (navigator as any).share === "function";
}

export async function copyLink(url: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(url); return true; } catch { return false; }
}

export const SHARE_TARGETS: { id: string; label: string; href: (p: SharePayload) => string }[] = [
  { id: "facebook", label: "Facebook", href: p => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(p.url)}` },
  { id: "x",        label: "X",        href: p => `https://twitter.com/intent/tweet?text=${encodeURIComponent(p.text)}&url=${encodeURIComponent(p.url)}` },
  { id: "whatsapp", label: "WhatsApp", href: p => `https://wa.me/?text=${encodeURIComponent(p.text + " " + p.url)}` },
  { id: "telegram", label: "Telegram", href: p => `https://t.me/share/url?url=${encodeURIComponent(p.url)}&text=${encodeURIComponent(p.text)}` },
  { id: "email",    label: "Email",    href: p => `mailto:?subject=${encodeURIComponent(p.title || "roam.")}&body=${encodeURIComponent(p.text + "\n\n" + p.url)}` },
];
