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

export const usersRepo = {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  },

  // Batch fetch users by id in one query (avoids N+1 when enriching members).
  async getUsersByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    return db.select().from(users).where(inArray(users.id, ids));
  },

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  },

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  },

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  },

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  },

  async countFoundingMembers(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.isFoundingMember, true));
    return Number(result[0]?.count ?? 0);
  },

  async getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
    const [found] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
    return found;
  },

  async deleteUser(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  },

  async updateUserVerification(userId: string, verificationId: string | null, verified: boolean): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({
        identityVerified: verified,
        identityVerificationId: verificationId,
        identityVerifiedAt: verified ? new Date() : null,
      })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  },

};
