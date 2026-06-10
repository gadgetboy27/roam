// Remembers where to send a user after they finish auth/onboarding — used by the
// public event landing flow so a stranger who signs up to RSVP lands back on the
// event instead of the generic /discover.
const KEY = "roam:nextAfterAuth";

export function setNextRoute(path: string) {
  try { localStorage.setItem(KEY, path); } catch { /* ignore */ }
}

export function consumeNextRoute(fallback = "/discover"): string {
  try {
    const n = localStorage.getItem(KEY);
    if (n) { localStorage.removeItem(KEY); return n; }
  } catch { /* ignore */ }
  return fallback;
}

// "Invite your crew" referral: stash the inviter's id when a friend opens a /join
// link, then consume it after onboarding to auto-connect the two.
const REF_KEY = "roam:referrerId";

export function setReferrer(id: string) {
  try { localStorage.setItem(REF_KEY, id); } catch { /* ignore */ }
}

export function consumeReferrer(): string | null {
  try {
    const id = localStorage.getItem(REF_KEY);
    if (id) { localStorage.removeItem(REF_KEY); return id; }
  } catch { /* ignore */ }
  return null;
}
