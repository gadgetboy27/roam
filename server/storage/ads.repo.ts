import { eq, and, or, desc, inArray, gt, gte, sql } from "drizzle-orm";
import { db } from "../db";
import {
  users, photos, matches, messages, bucketList, ads, adminUsers, adminAuditLog,
  groups, groupMembers, groupMessages, groupEvents, groupEventAttendees, groupInvites, notifications,
  type User, type InsertUser, type Photo, type InsertPhoto,
  type Match, type InsertMatch, type Message, type InsertMessage,
  type BucketListItem, type InsertBucketList, type Ad, type InsertAd,
  type AdminUser, type InsertAdminUser,
  type Group, type InsertGroup, type GroupMember, type InsertGroupMember,
  type GroupMessage, type GroupEvent, type InsertGroupEvent,
  type GroupInvite, type InsertGroupInvite,
  type Notification,
  type AdminAuditLog, type InsertAdminAuditLog,
} from "@shared/schema";

export const adsRepo = {
  async createAd(ad: InsertAd): Promise<Ad> {
    const [created] = await db.insert(ads).values(ad).returning();
    return created;
  },

  async getAdById(id: string): Promise<Ad | undefined> {
    const [ad] = await db.select().from(ads).where(eq(ads.id, id));
    return ad;
  },

  async getAllAds(): Promise<Ad[]> {
    return db.select().from(ads).orderBy(desc(ads.createdAt));
  },

  async getAdsByStatus(status: string): Promise<Ad[]> {
    return db.select().from(ads).where(eq(ads.status, status as any)).orderBy(desc(ads.createdAt));
  },

  async getLiveAd(): Promise<Ad | undefined> {
    const now = new Date();
    const liveAds = await db.select().from(ads).where(eq(ads.status, "approved"));
    const valid = liveAds.filter(a => !a.expiresAt || a.expiresAt > now);
    if (valid.length === 0) return undefined;
    return valid[Math.floor(Math.random() * valid.length)];
  },

  async getPublicEventAds(): Promise<Ad[]> {
    const now = new Date();
    const rows = await db.select().from(ads)
      .where(and(eq(ads.status, "approved"), eq(ads.adType as any, "event")))
      .orderBy((ads as any).eventStartAt);
    return rows.filter(a => !a.eventStartAt || new Date(a.eventStartAt) > now);
  },

  async updateAd(id: string, data: Partial<InsertAd & { reviewedAt: Date | null; expiresAt: Date | null; impressions: number }>): Promise<Ad | undefined> {
    const [updated] = await db.update(ads).set(data as any).where(eq(ads.id, id)).returning();
    return updated;
  },

};
