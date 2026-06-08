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

export const notificationsRepo = {
  async createNotification(data: { userId: string; type: string; title: string; body?: string; data?: string }): Promise<Notification> {
    const [created] = await db.insert(notifications).values(data).returning();
    return created;
  },

  async getNotificationsForUser(userId: string, limit = 30): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  },

  // Returns an existing unread notification of `type` for `userId` whose `data`
  // JSON contains the given key/value (e.g. matchId or groupId). Used to dedupe
  // "new message" alerts so a recipient gets one notification per conversation
  // until they read it, rather than one per message.
  async findUnreadNotification(userId: string, type: string, dataKey: string, dataValue: string): Promise<Notification | undefined> {
    const needle = `%"${dataKey}":"${dataValue}"%`;
    const [row] = await db.select().from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.type, type),
        eq(notifications.isRead, false),
        sql`${notifications.data} LIKE ${needle}`,
      ))
      .limit(1);
    return row;
  },

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const rows = await db.select().from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return rows.length;
  },

  async getNotificationById(id: number): Promise<Notification | undefined> {
    const [row] = await db.select().from(notifications).where(eq(notifications.id, id));
    return row;
  },

  async markNotificationRead(id: number): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  },

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
  },

};
