import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, real, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tierEnum = pgEnum("tier", ["free", "adventurer", "contributor"]);
export const photoVerdictEnum = pgEnum("photo_verdict", ["approved", "needs_person", "rejected_quote", "rejected_manipulated", "rejected_stock"]);
export const matchStatusEnum = pgEnum("match_status", ["pending", "liked_a", "liked_b", "matched", "passed"]);
export const adStatusEnum = pgEnum("ad_status", ["pending_payment", "pending_review", "approved", "rejected", "expired"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  dob: text("dob"),
  gender: text("gender"),
  ethnicity: text("ethnicity"),
  location: text("location"),
  tagline: text("tagline"),
  tier: tierEnum("tier").default("free").notNull(),
  photoLicenseAgreed: boolean("photo_license_agreed").default(false),
  adventureTags: text("adventure_tags").array(),
  avatarUrl: text("avatar_url"),
  identityVerified: boolean("identity_verified").default(false),
  identityVerificationId: text("identity_verification_id"),
  identityVerifiedAt: timestamp("identity_verified_at"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const photos = pgTable("photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  storageUrl: text("storage_url").notNull(),
  caption: text("caption"),
  personScore: integer("person_score").default(0),
  authenticityScore: integer("authenticity_score").default(100),
  adventureScore: integer("adventure_score").default(0),
  verdict: photoVerdictEnum("verdict").default("approved"),
  tags: text("tags").array(),
  manipulationFlags: text("manipulation_flags").array(),
  isLicensable: boolean("is_licensable").default(false),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const matches = pgTable("matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userAId: varchar("user_a_id").notNull(),
  userBId: varchar("user_b_id").notNull(),
  overlapScore: real("overlap_score").default(0),
  sharedTags: text("shared_tags").array(),
  status: matchStatusEnum("status").default("pending"),
  almostMetLocation: text("almost_met_location"),
  almostMetDate: text("almost_met_date"),
  createdAt: timestamp("created_at").defaultNow(),
  matchedAt: timestamp("matched_at"),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull(),
  senderId: varchar("sender_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bucketList = pgTable("bucket_list", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  destinationName: text("destination_name").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ads = pgTable("ads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  advertiserName: text("advertiser_name").notNull(),
  advertiserEmail: text("advertiser_email").notNull(),
  advertiserCompany: text("advertiser_company"),
  tier: text("tier").notNull(),
  headline: text("headline").notNull(),
  tagline: text("tagline"),
  ctaText: text("cta_text"),
  ctaUrl: text("cta_url"),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  contentType: text("content_type").notNull().default("image"),
  status: adStatusEnum("status").default("pending_payment").notNull(),
  stripeSessionId: text("stripe_session_id"),
  rejectionReason: text("rejection_reason"),
  reviewedAt: timestamp("reviewed_at"),
  expiresAt: timestamp("expires_at"),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
});

export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = typeof adminUsers.$inferInsert;

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertPhotoSchema = createInsertSchema(photos).omit({ id: true, createdAt: true });
export const insertMatchSchema = createInsertSchema(matches).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertBucketListSchema = createInsertSchema(bucketList).omit({ id: true, createdAt: true });

export const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  dob: z.string().optional(),
  gender: z.string().optional(),
  ethnicity: z.string().optional(),
  location: z.string().optional(),
  tagline: z.string().max(60, "Must be 60 characters or less").optional(),
  tier: z.enum(["free", "adventurer", "contributor"]).default("free"),
  photoLicenseAgreed: z.boolean().default(false),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type BucketListItem = typeof bucketList.$inferSelect;
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertBucketList = z.infer<typeof insertBucketListSchema>;

export const insertAdSchema = createInsertSchema(ads).omit({ id: true, createdAt: true, reviewedAt: true, expiresAt: true, impressions: true });
export type Ad = typeof ads.$inferSelect;
export type InsertAd = z.infer<typeof insertAdSchema>;
