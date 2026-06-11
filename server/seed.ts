import { db } from "./db";
import { users, photos, matches } from "@shared/schema";
import { hashPassword } from "./auth";
import { eq } from "drizzle-orm";

export async function seedDatabase() {
  // Never seed demo users in production — they're for local dev only. (Even if the
  // DB were emptied, prod must stay free of fake "Mia/Kai/Sam/Demo" accounts.)
  if (process.env.NODE_ENV === "production") {
    console.log("[seed] production — skipping demo seed");
    return;
  }
  const existingUsers = await db.select().from(users);
  if (existingUsers.length > 0) {
    console.log("Database already seeded, skipping...");
    return;
  }

  console.log("Seeding database with demo data...");

  const password = await hashPassword("adventure123");

  const [mia] = await db.insert(users).values({
    name: "Mia Chen",
    email: "mia@demo.roam",
    password,
    dob: "1997-03-15",
    gender: "Woman",
    location: "Queenstown, NZ",
    tagline: "Chasing elevation, good coffee and anything with a summit",
    tier: "adventurer",
    adventureTags: ["climbing", "alpine hiking", "night markets", "coastal walks", "via ferrata"],
    avatarUrl: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=200&q=80&fit=crop",
  }).returning();

  const [kai] = await db.insert(users).values({
    name: "Kai Roberts",
    email: "kai@demo.roam",
    password,
    dob: "1994-08-22",
    gender: "Man",
    location: "Raglan, NZ",
    tagline: "Lost in alleyways, found in barrels",
    tier: "contributor",
    photoLicenseAgreed: true,
    adventureTags: ["surfing", "night markets", "urban roaming", "freediving", "desert camping"],
    avatarUrl: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=200&q=80&fit=crop",
  }).returning();

  const [sam] = await db.insert(users).values({
    name: "Sam Taylor",
    email: "sam@demo.roam",
    password,
    dob: "1999-11-04",
    gender: "Non-binary",
    location: "Nelson, NZ",
    tagline: "Every forest has a path worth getting lost on",
    tier: "free",
    adventureTags: ["backpacking", "kayaking", "forest trails", "foraging", "wilderness photography"],
    avatarUrl: "https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=200&q=80&fit=crop",
  }).returning();

  const [demo] = await db.insert(users).values({
    name: "Demo User",
    email: "demo@roam.app",
    password: await hashPassword("demo1234"),
    dob: "1996-06-20",
    gender: "Prefer not to say",
    location: "Auckland, NZ",
    tagline: "Always looking for the next adventure",
    tier: "adventurer",
    adventureTags: ["climbing", "alpine hiking", "surfing", "night markets", "urban roaming", "kayaking", "forest trails", "coastal walks"],
    avatarUrl: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=200&q=80&fit=crop",
  }).returning();

  const miaPhotos = [
    { userId: mia.id, storageUrl: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=85&fit=crop", personScore: 92, authenticityScore: 95, adventureScore: 88, verdict: "approved" as const, tags: ["rock climbing", "alpine"], displayOrder: 0 },
    { userId: mia.id, storageUrl: "https://images.unsplash.com/photo-1527856263986-730571966ce7?w=400&q=80&fit=crop", personScore: 85, authenticityScore: 90, adventureScore: 82, verdict: "approved" as const, tags: ["hiking", "alpine trail"], displayOrder: 1 },
    { userId: mia.id, storageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80&fit=crop", personScore: 8, authenticityScore: 95, adventureScore: 75, verdict: "needs_person" as const, tags: ["mountain", "summit"], displayOrder: 2 },
    { userId: mia.id, storageUrl: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&q=80&fit=crop", personScore: 5, authenticityScore: 92, adventureScore: 70, verdict: "needs_person" as const, tags: ["mountain hut", "landscape"], displayOrder: 3 },
  ];

  const kaiPhotos = [
    { userId: kai.id, storageUrl: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=85&fit=crop", personScore: 78, authenticityScore: 92, adventureScore: 90, verdict: "approved" as const, tags: ["surfing", "ocean"], displayOrder: 0 },
    { userId: kai.id, storageUrl: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400&q=80&fit=crop", personScore: 45, authenticityScore: 88, adventureScore: 72, verdict: "approved" as const, tags: ["tokyo alley", "night market"], displayOrder: 1 },
    { userId: kai.id, storageUrl: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&q=80&fit=crop", personScore: 10, authenticityScore: 94, adventureScore: 80, verdict: "needs_person" as const, tags: ["aerial coast", "landscape"], displayOrder: 2 },
  ];

  const samPhotos = [
    { userId: sam.id, storageUrl: "https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=800&q=85&fit=crop", personScore: 72, authenticityScore: 88, adventureScore: 78, verdict: "approved" as const, tags: ["forest trail", "backpacking"], displayOrder: 0 },
    { userId: sam.id, storageUrl: "https://images.unsplash.com/photo-1533240332313-0db49b459ad6?w=400&q=80&fit=crop", personScore: 65, authenticityScore: 90, adventureScore: 74, verdict: "approved" as const, tags: ["forest", "hiking"], displayOrder: 1 },
    { userId: sam.id, storageUrl: "https://images.unsplash.com/photo-1497449493050-aad1e7cad165?w=400&q=80&fit=crop", personScore: 55, authenticityScore: 85, adventureScore: 80, verdict: "approved" as const, tags: ["kayaking", "river"], displayOrder: 2 },
  ];

  await db.insert(photos).values([...miaPhotos, ...kaiPhotos, ...samPhotos]);

  await db.insert(matches).values([
    {
      userAId: demo.id,
      userBId: mia.id,
      overlapScore: 0.78,
      sharedTags: ["climbing", "alpine hiking", "night markets"],
      status: "matched",
      almostMetLocation: "Milford Sound",
      almostMetDate: "Jan 2024",
    },
    {
      userAId: demo.id,
      userBId: kai.id,
      overlapScore: 0.64,
      sharedTags: ["surfing", "night markets", "urban roaming"],
      status: "matched",
    },
    {
      userAId: demo.id,
      userBId: sam.id,
      overlapScore: 0.59,
      sharedTags: ["backpacking", "kayaking", "forest trails"],
      status: "matched",
      almostMetLocation: "Abel Tasman",
      almostMetDate: "Nov 2023",
    },
  ]);

  console.log("Database seeded successfully!");
}
