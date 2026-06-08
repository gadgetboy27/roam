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

export const matchesRepo = {
  async createMatch(match: InsertMatch): Promise<Match> {
    const [created] = await db.insert(matches).values(match).returning();
    return created;
  },

  async getMatchById(id: string): Promise<Match | undefined> {
    const [found] = await db.select().from(matches).where(eq(matches.id, id)).limit(1);
    return found;
  },

  async getMatchesForUser(userId: string): Promise<Match[]> {
    return db.select().from(matches).where(
      or(eq(matches.userAId, userId), eq(matches.userBId, userId))
    ).orderBy(desc(matches.createdAt));
  },

  async getMonthlyConnectionsSent(userId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    // Only count matches where this user is the initiator (userAId).
    // Counting both sides was wrong — incoming likes from others would consume
    // the user's own monthly limit.
    const result = await db.select({ count: sql<number>`count(*)` }).from(matches).where(
      and(
        eq(matches.userAId, userId),
        gte(matches.createdAt, startOfMonth),
      )
    );
    return Number(result[0]?.count ?? 0);
  },

  async getMatchBetween(userAId: string, userBId: string): Promise<Match | undefined> {
    const [found] = await db.select().from(matches).where(
      or(
        and(eq(matches.userAId, userAId), eq(matches.userBId, userBId)),
        and(eq(matches.userAId, userBId), eq(matches.userBId, userAId)),
      )
    ).limit(1);
    return found;
  },

  async updateMatchStatus(id: string, status: string, extra?: Record<string, any>): Promise<Match | undefined> {
    const [updated] = await db.update(matches)
      .set({ status: status as any, ...(extra || {}) })
      .where(eq(matches.id, id))
      .returning();
    return updated;
  },

  async getMatchedUserIds(userId: string): Promise<string[]> {
    const rows = await db.select().from(matches).where(
      and(
        or(eq(matches.userAId, userId), eq(matches.userBId, userId)),
        eq(matches.status, "matched")
      )
    );
    return rows.map(m => m.userAId === userId ? m.userBId : m.userAId);
  },

  async getInteractedUserIds(userId: string): Promise<string[]> {
    const rows = await db
      .select({ userAId: matches.userAId, userBId: matches.userBId })
      .from(matches)
      .where(or(eq(matches.userAId, userId), eq(matches.userBId, userId)));
    return rows.map(r => r.userAId === userId ? r.userBId : r.userAId);
  },

  async createPass(userAId: string, userBId: string): Promise<void> {
    const existing = await this.getMatchBetween(userAId, userBId);
    if (!existing) {
      await db.insert(matches).values({ userAId, userBId, status: "passed" });
    }
  },

};
