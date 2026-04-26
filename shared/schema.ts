import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, real, serial, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tierEnum = pgEnum("tier", ["free", "adventurer", "contributor"]);
export const photoVerdictEnum = pgEnum("photo_verdict", ["approved", "needs_person", "rejected_quote", "rejected_manipulated", "rejected_stock"]);
export const matchStatusEnum = pgEnum("match_status", ["pending", "liked_a", "liked_b", "matched", "passed"]);
export const adStatusEnum = pgEnum("ad_status", ["pending_payment", "pending_review", "approved", "rejected", "expired"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password"),
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
  openToRoaming: boolean("open_to_roaming").default(false),
  isFoundingMember: boolean("is_founding_member").default(false),
  isTierGifted: boolean("is_tier_gifted").default(false),
  boostExpiresAt: timestamp("boost_expires_at"),
  isOrganiser: boolean("is_organiser").default(false).notNull(),
  stripeConnectAccountId: text("stripe_connect_account_id"),
  stripeConnectOnboarded: boolean("stripe_connect_onboarded").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_users_stripe_customer").on(table.stripeCustomerId),
  index("idx_users_email").on(table.email),
  index("idx_users_boost_expires").on(table.boostExpiresAt),
]);

export const photos = pgTable("photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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
}, (table) => [
  index("idx_photos_user_id").on(table.userId),
]);

export const matches = pgTable("matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userAId: varchar("user_a_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  userBId: varchar("user_b_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  overlapScore: real("overlap_score").default(0),
  sharedTags: text("shared_tags").array(),
  status: matchStatusEnum("status").default("pending"),
  almostMetLocation: text("almost_met_location"),
  almostMetDate: text("almost_met_date"),
  createdAt: timestamp("created_at").defaultNow(),
  matchedAt: timestamp("matched_at"),
}, (table) => [
  index("idx_matches_user_a").on(table.userAId),
  index("idx_matches_user_b").on(table.userBId),
  index("idx_matches_status").on(table.status),
]);

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_messages_match").on(table.matchId, table.createdAt),
]);

export const bucketList = pgTable("bucket_list", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  destinationName: text("destination_name").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_bucket_list_user").on(table.userId),
]);

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
  adType: text("ad_type").default("standard").notNull(),
  submittedByUserId: varchar("submitted_by_user_id"),
  linkedGroupId: varchar("linked_group_id"),
  linkedEventId: varchar("linked_event_id"),
  eventStartAt: timestamp("event_start_at"),
  eventLocation: text("event_location"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ads_status").on(table.status),
]);

export const groups = pgTable("groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("squad"),
  maxSize: integer("max_size").notNull().default(5),
  leaderId: varchar("leader_id").notNull(),
  location: text("location"),
  adventureTags: text("adventure_tags").array(),
  coverImageUrl: text("cover_image_url"),
  visibility: text("visibility").notNull().default("open"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_groups_leader").on(table.leaderId),
]);

export const groupMembers = pgTable("group_members", {
  id: serial("id").primaryKey(),
  groupId: varchar("group_id").notNull(),
  userId: varchar("user_id").notNull(),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at").defaultNow(),
  joinedAt: timestamp("joined_at"),
}, (table) => [
  index("idx_group_members_group").on(table.groupId),
  index("idx_group_members_user").on(table.userId),
]);

export const groupMessages = pgTable("group_messages", {
  id: serial("id").primaryKey(),
  groupId: varchar("group_id").notNull(),
  senderId: varchar("sender_id").notNull(),
  content: text("content").notNull(),
  isAnnouncement: boolean("is_announcement").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_group_messages_group").on(table.groupId, table.createdAt),
]);

export const groupEvents = pgTable("group_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull(),
  createdBy: varchar("created_by").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at"),
  ticketPriceNzd: integer("ticket_price_nzd"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_group_events_group").on(table.groupId),
]);

export const groupEventAttendees = pgTable("group_event_attendees", {
  id: serial("id").primaryKey(),
  eventId: varchar("event_id").notNull(),
  userId: varchar("user_id").notNull(),
  ticketPaid: boolean("ticket_paid").default(false).notNull(),
  ticketSessionId: text("ticket_session_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_event_attendees_event").on(table.eventId),
  index("idx_event_attendees_user").on(table.userId),
]);

export const groupInvites = pgTable("group_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull(),
  invitedEmail: text("invited_email").notNull(),
  invitedByUserId: varchar("invited_by_user_id").notNull(),
  token: varchar("token").notNull().unique(),
  status: text("status").notNull().default("pending"),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export type GroupInvite = typeof groupInvites.$inferSelect;
export type InsertGroupInvite = typeof groupInvites.$inferInsert;

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  data: text("data"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_notifications_user").on(table.userId, table.isRead),
]);

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

export const adminAuditLog = pgTable("admin_audit_log", {
  id: serial("id").primaryKey(),
  adminId: varchar("admin_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  details: text("details"),
  ip: text("ip"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_audit_log_admin").on(table.adminId),
  index("idx_audit_log_created").on(table.createdAt),
]);

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLog.$inferInsert;

export const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password must be 128 characters or less"),
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

export type Group = typeof groups.$inferSelect;
export type InsertGroup = typeof groups.$inferInsert;
export type GroupMember = typeof groupMembers.$inferSelect;
export type InsertGroupMember = typeof groupMembers.$inferInsert;
export type GroupMessage = typeof groupMessages.$inferSelect;
export type InsertGroupMessage = typeof groupMessages.$inferInsert;
export type GroupEvent = typeof groupEvents.$inferSelect;
export type InsertGroupEvent = typeof groupEvents.$inferInsert;
export type GroupEventAttendee = typeof groupEventAttendees.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
