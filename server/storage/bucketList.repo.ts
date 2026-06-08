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

export const bucketListRepo = {
  async createBucketItem(item: InsertBucketList): Promise<BucketListItem> {
    const [created] = await db.insert(bucketList).values(item).returning();
    return created;
  },

  async getBucketItem(id: string): Promise<BucketListItem | undefined> {
    const [item] = await db.select().from(bucketList).where(eq(bucketList.id, id));
    return item;
  },

  async getBucketListByUser(userId: string): Promise<BucketListItem[]> {
    return db.select().from(bucketList).where(eq(bucketList.userId, userId));
  },

  async deleteBucketItem(id: string): Promise<void> {
    await db.delete(bucketList).where(eq(bucketList.id, id));
  },

};
