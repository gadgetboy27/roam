import { eq, and, or, desc, inArray, gt, gte, sql } from "drizzle-orm";
import { db } from "../db";
import {
  users, photos, matches, messages, bucketList, ads, adminUsers, adminAuditLog,
  groups, groupMembers, groupMessages, groupEvents, groupEventAttendees, groupInvites, notifications,
  blocks, reports, safetyContacts, safetyCheckins, safetyAlertLog, typingIndicators, visitedPlaces,
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

  // Fully delete a user and ALL of their personal data, atomically.
  //
  // Only four tables (matches, messages, notifications, photos) have an
  // ON DELETE CASCADE FK to users, so deleting just the users row would leave
  // the rest behind — including PII like safety contacts and check-in
  // locations. That breaks the deletion promise (and "right to be forgotten").
  // So we explicitly remove every user-owned row first, in one transaction, then
  // delete the users row (which fires the existing cascades). If any step fails
  // the whole thing rolls back — no half-deleted account.
  //
  // Shared/community artifacts the user created (groups they lead, group events,
  // paid ads) are intentionally left intact so other members aren't affected;
  // reassigning group leadership on delete is a separate policy decision.
  async deleteUser(userId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Safety data (PII: emergency contacts, locations, alert history).
      await tx.delete(safetyAlertLog).where(eq(safetyAlertLog.userId, userId));
      await tx.delete(safetyCheckins).where(eq(safetyCheckins.userId, userId));
      await tx.delete(safetyContacts).where(
        or(eq(safetyContacts.userId, userId), eq(safetyContacts.contactUserId, userId))
      );

      // Moderation rows referencing the user on either side.
      await tx.delete(blocks).where(
        or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId))
      );
      await tx.delete(reports).where(
        or(eq(reports.reporterId, userId), eq(reports.reportedId, userId))
      );

      // Group participation + the user's own group chat content.
      await tx.delete(groupEventAttendees).where(eq(groupEventAttendees.userId, userId));
      await tx.delete(groupMessages).where(eq(groupMessages.senderId, userId));
      await tx.delete(groupMembers).where(eq(groupMembers.userId, userId));

      // Misc owned rows.
      await tx.delete(bucketList).where(eq(bucketList.userId, userId));
      await tx.delete(visitedPlaces).where(eq(visitedPlaces.userId, userId));
      await tx.delete(typingIndicators).where(eq(typingIndicators.userId, userId));

      // Finally the user row — cascades matches/messages/notifications/photos.
      await tx.delete(users).where(eq(users.id, userId));
    });
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
