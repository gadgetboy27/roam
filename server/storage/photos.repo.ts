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

export const photosRepo = {
  async createPhoto(photo: InsertPhoto): Promise<Photo> {
    const [created] = await db.insert(photos).values(photo).returning();
    return created;
  },

  async getPhotosByUser(userId: string): Promise<Photo[]> {
    return db.select().from(photos).where(eq(photos.userId, userId)).orderBy(photos.displayOrder);
  },

  async getFirstApprovedPhotoPerUser(): Promise<Record<string, string>> {
    const approved = await db
      .select({ userId: photos.userId, storageUrl: photos.storageUrl })
      .from(photos)
      .where(eq(photos.verdict, "approved"))
      .orderBy(photos.displayOrder);
    const map: Record<string, string> = {};
    for (const p of approved) {
      if (!map[p.userId]) map[p.userId] = p.storageUrl;
    }
    return map;
  },

  async getAllPhotosForUsers(userIds: string[]): Promise<Record<string, Photo[]>> {
    if (!userIds.length) return {};
    const rows = await db
      .select()
      .from(photos)
      .where(inArray(photos.userId, userIds))
      .orderBy(photos.displayOrder);
    const map: Record<string, Photo[]> = {};
    for (const p of rows) {
      if (!map[p.userId]) map[p.userId] = [];
      map[p.userId].push(p);
    }
    return map;
  },

};
