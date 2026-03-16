/**
 * Client-side adventure fingerprint utilities.
 * Exposed outputs only — raw scores, weights and algorithm details
 * stay on the server. Users see vibe words and honesty tiers, not numbers.
 */

const VIBE_CLUSTERS: Record<string, string[]> = {
  "Deep Wilderness": [
    "alpine hiking", "rock climbing", "canyoning", "via ferrata",
    "extreme sports", "backpacking", "forest trails", "trail running",
    "skydiving", "bungee jumping",
  ],
  "Urban Nomad": [
    "night markets", "urban roaming", "couch surfing", "pub games",
    "food & wine trails", "photography", "sports matches",
  ],
  "Coastal Drifter": [
    "surfing", "kayaking", "scuba diving", "boating / fishing", "coastal walks",
  ],
  "High Altitude": [
    "skiing", "snowboarding", "paragliding", "mountain biking",
    "extreme sports",
  ],
  "Festival Circuit": [
    "sports matches", "food & wine trails", "night markets", "pub games",
    "urban roaming",
  ],
  "Slow Travel": [
    "walking", "horse riding", "yoga / wellness", "cycling", "photography",
  ],
};

export function computeVibeWord(tags: string[] | null | undefined): string {
  if (!tags?.length) return "Free Roamer";
  const lower = tags.map(t => t.toLowerCase());
  let best = { vibe: "Free Roamer", score: 0 };
  for (const [vibe, clusterTags] of Object.entries(VIBE_CLUSTERS)) {
    const score = clusterTags.filter(t => lower.includes(t)).length;
    if (score > best.score) best = { vibe, score };
  }
  return best.vibe;
}

export type HonestyTier = "verified-adventure" | "mostly-verified" | "unverified";

export interface HonestyDisplay {
  tier: HonestyTier;
  label: string;
  color: string;
  symbol: string;
}

export function getHonestyDisplay(tier: HonestyTier): HonestyDisplay {
  switch (tier) {
    case "verified-adventure":
      return { tier, label: "Verified Adventure", color: "var(--roam-electric)", symbol: "✦" };
    case "mostly-verified":
      return { tier, label: "Mostly Verified", color: "var(--roam-sky)", symbol: "◈" };
    default:
      return { tier, label: "Unverified", color: "rgba(242,237,227,0.3)", symbol: "○" };
  }
}

// Demo fingerprints for display — real scores are computed server-side
export const DEMO_VIBE_WORDS: Record<string, string> = {
  "match-1": "Deep Wilderness",
  "match-2": "Coastal Drifter",
  "match-3": "Slow Travel",
};

export const DEMO_HONESTY: Record<string, HonestyTier> = {
  "match-1": "verified-adventure",
  "match-2": "verified-adventure",
  "match-3": "mostly-verified",
};
