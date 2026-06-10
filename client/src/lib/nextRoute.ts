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
