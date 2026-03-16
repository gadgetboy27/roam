/**
 * PROPRIETARY — Adventure Fingerprint Engine
 *
 * All computation is performed server-side. The raw overlap scores,
 * tag weights and fingerprint vectors are never transmitted to clients.
 * Users only see derived outputs (vibe word, honesty tier) — never
 * the underlying algorithm or data.
 */

import type { Photo, User } from "@shared/schema";

const RARE_TAGS = new Set([
  "canyoning", "via ferrata", "skydiving", "bungee jumping", "paragliding",
  "base jumping", "free diving", "wingsuit", "ice climbing",
  "horse riding", "boating / fishing", "dog sledding",
]);

const UNCOMMON_TAGS = new Set([
  "extreme sports", "snowboarding", "mountain biking", "scuba diving",
  "trail running", "alpine hiking", "kayaking", "couch surfing",
  "sports matches", "pub games",
]);

const COMMON_TAGS = new Set([
  "surfing", "hiking", "skiing", "cycling", "walking", "running",
  "photography", "backpacking", "food & wine trails", "night markets",
  "urban roaming", "yoga / wellness", "forest trails", "coastal walks",
  "rock climbing",
]);

function tagWeight(tag: string): number {
  const t = tag.toLowerCase();
  if (RARE_TAGS.has(t)) return 4;
  if (UNCOMMON_TAGS.has(t)) return 2.5;
  if (COMMON_TAGS.has(t)) return 1;
  return 1.5; // unclassified but tagged by AI = slightly exotic
}

/** Build a normalised tag→weight map for a user from their photos + manual tags */
export function buildFingerprint(
  photos: Photo[],
  adventureTags: string[] | null,
): Map<string, number> {
  const fp = new Map<string, number>();

  photos.forEach(p => {
    (p.tags ?? []).forEach(raw => {
      const t = raw.toLowerCase().trim();
      const w = tagWeight(t) * (1 + (p.adventureScore ?? 0) / 200);
      fp.set(t, (fp.get(t) ?? 0) + w);
    });
  });

  (adventureTags ?? []).forEach(raw => {
    const t = raw.toLowerCase().trim();
    const w = tagWeight(t) * 1.4; // manual picks carry extra signal
    fp.set(t, Math.max(fp.get(t) ?? 0, w));
  });

  return fp;
}

/** Compute overlap score (0–1) and shared tag list between two fingerprints */
export function computeOverlap(
  fpA: Map<string, number>,
  fpB: Map<string, number>,
): { score: number; sharedTags: string[] } {
  if (!fpA.size || !fpB.size) return { score: 0, sharedTags: [] };

  let sharedWeight = 0;
  const sharedTags: string[] = [];
  const allTags = new Set([...fpA.keys(), ...fpB.keys()]);

  allTags.forEach(tag => {
    const wA = fpA.get(tag) ?? 0;
    const wB = fpB.get(tag) ?? 0;
    if (wA > 0 && wB > 0) {
      sharedWeight += Math.min(wA, wB);
      sharedTags.push(tag);
    }
  });

  const maxPossible = [...allTags].reduce(
    (sum, tag) => sum + Math.max(fpA.get(tag) ?? 0, fpB.get(tag) ?? 0),
    0,
  );

  const score = maxPossible > 0 ? Math.round((sharedWeight / maxPossible) * 100) / 100 : 0;
  return { score, sharedTags };
}

/** Detect "Almost Met" if both users share a location-like tag in photos */
export function detectAlmostMet(
  photosA: Photo[],
  photosB: Photo[],
): { location: string; dateHint: string } | null {
  const locationPattern = /\b(bali|kyoto|patagonia|iceland|faroe|lofoten|queenstown|abel tasman|rangitoto|fiordland|milford|tongariro|london|tokyo|new york|barcelona|lisbon|auckland|wellington|sydney|melbourne|rio|marrakech|santorini|phuket|seoul|bangkok|cappadocia|dubrovnik|havana)\b/i;

  const locationsA = new Map<string, Photo>();
  photosA.forEach(p => {
    const match = (p.caption ?? "").match(locationPattern) ?? ((p.tags ?? []).join(" ")).match(locationPattern);
    if (match) locationsA.set(match[0].toLowerCase(), p);
  });

  for (const p of photosB) {
    const match = (p.caption ?? "").match(locationPattern) ?? ((p.tags ?? []).join(" ")).match(locationPattern);
    if (match) {
      const loc = match[0].toLowerCase();
      if (locationsA.has(loc)) {
        const photoA = locationsA.get(loc)!;
        const yearA = photoA.createdAt ? new Date(photoA.createdAt).getFullYear() : null;
        const yearB = p.createdAt ? new Date(p.createdAt).getFullYear() : null;
        const sameYear = yearA && yearB && Math.abs(yearA - yearB) <= 1;
        return {
          location: loc.charAt(0).toUpperCase() + loc.slice(1),
          dateHint: sameYear ? `${yearA}` : "different times — still",
        };
      }
    }
  }
  return null;
}

/** Compute honesty tier from a user's photo record */
export function computeHonestyTier(photos: Photo[]): "verified-adventure" | "mostly-verified" | "unverified" {
  if (!photos.length) return "unverified";
  const approved = photos.filter(p => p.verdict === "approved").length;
  const ratio = approved / photos.length;
  const avgAuth = photos.reduce((s, p) => s + (p.authenticityScore ?? 100), 0) / photos.length;
  if (ratio >= 0.8 && avgAuth >= 75) return "verified-adventure";
  if (ratio >= 0.5 || avgAuth >= 50) return "mostly-verified";
  return "unverified";
}
