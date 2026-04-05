import { eq, and, or, desc, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  users, photos, matches, messages, bucketList, ads, adminUsers,
  type User, type InsertUser, type Photo, type InsertPhoto,
  type Match, type InsertMatch, type Message, type InsertMessage,
  type BucketListItem, type InsertBucketList, type Ad, type InsertAd,
  type AdminUser, type InsertAdminUser,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;

  createPhoto(photo: InsertPhoto): Promise<Photo>;
  getPhotosByUser(userId: string): Promise<Photo[]>;
  getFirstApprovedPhotoPerUser(): Promise<Record<string, string>>;

  createMatch(match: InsertMatch): Promise<Match>;
  getMatchesForUser(userId: string): Promise<Match[]>;
  getMatchBetween(userAId: string, userBId: string): Promise<Match | undefined>;
  updateMatchStatus(id: string, status: string, extra?: Partial<InsertMatch>): Promise<Match | undefined>;

  createMessage(message: InsertMessage): Promise<Message>;
  getMessagesByMatch(matchId: string): Promise<Message[]>;

  createBucketItem(item: InsertBucketList): Promise<BucketListItem>;
  getBucketListByUser(userId: string): Promise<BucketListItem[]>;
  deleteBucketItem(id: string): Promise<void>;

  updateUserVerification(userId: string, verificationId: string | null, verified: boolean): Promise<User | undefined>;
  deleteUser(userId: string): Promise<void>;

  createAd(ad: InsertAd): Promise<Ad>;
  getAdById(id: string): Promise<Ad | undefined>;
  getAllAds(): Promise<Ad[]>;
  getAdsByStatus(status: string): Promise<Ad[]>;
  getLiveAd(): Promise<Ad | undefined>;
  updateAd(id: string, data: Partial<InsertAd & { reviewedAt: Date | null; expiresAt: Date | null; impressions: number }>): Promise<Ad | undefined>;

  createAdmin(data: { username: string; passwordHash: string; displayName?: string; createdBy?: string }): Promise<AdminUser>;
  getAdminByUsername(username: string): Promise<AdminUser | undefined>;
  getAdminById(id: string): Promise<AdminUser | undefined>;
  getAllAdmins(): Promise<AdminUser[]>;
  getAdminCount(): Promise<number>;
  deleteAdmin(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async createPhoto(photo: InsertPhoto): Promise<Photo> {
    const [created] = await db.insert(photos).values(photo).returning();
    return created;
  }

  async getPhotosByUser(userId: string): Promise<Photo[]> {
    return db.select().from(photos).where(eq(photos.userId, userId)).orderBy(photos.displayOrder);
  }

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
  }

  async createMatch(match: InsertMatch): Promise<Match> {
    const [created] = await db.insert(matches).values(match).returning();
    return created;
  }

  async getMatchesForUser(userId: string): Promise<Match[]> {
    return db.select().from(matches).where(
      or(eq(matches.userAId, userId), eq(matches.userBId, userId))
    ).orderBy(desc(matches.createdAt));
  }

  async getMatchBetween(userAId: string, userBId: string): Promise<Match | undefined> {
    const [found] = await db.select().from(matches).where(
      or(
        and(eq(matches.userAId, userAId), eq(matches.userBId, userBId)),
        and(eq(matches.userAId, userBId), eq(matches.userBId, userAId)),
      )
    ).limit(1);
    return found;
  }

  async updateMatchStatus(id: string, status: string, extra?: Record<string, any>): Promise<Match | undefined> {
    const [updated] = await db.update(matches)
      .set({ status: status as any, ...(extra || {}) })
      .where(eq(matches.id, id))
      .returning();
    return updated;
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [created] = await db.insert(messages).values(message).returning();
    return created;
  }

  async getMessagesByMatch(matchId: string): Promise<Message[]> {
    return db.select().from(messages).where(eq(messages.matchId, matchId)).orderBy(messages.createdAt);
  }

  async createBucketItem(item: InsertBucketList): Promise<BucketListItem> {
    const [created] = await db.insert(bucketList).values(item).returning();
    return created;
  }

  async getBucketListByUser(userId: string): Promise<BucketListItem[]> {
    return db.select().from(bucketList).where(eq(bucketList.userId, userId));
  }

  async deleteBucketItem(id: string): Promise<void> {
    await db.delete(bucketList).where(eq(bucketList.id, id));
  }

  async deleteUser(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  async createAd(ad: InsertAd): Promise<Ad> {
    const [created] = await db.insert(ads).values(ad).returning();
    return created;
  }

  async getAdById(id: string): Promise<Ad | undefined> {
    const [ad] = await db.select().from(ads).where(eq(ads.id, id));
    return ad;
  }

  async getAllAds(): Promise<Ad[]> {
    return db.select().from(ads).orderBy(desc(ads.createdAt));
  }

  async getAdsByStatus(status: string): Promise<Ad[]> {
    return db.select().from(ads).where(eq(ads.status, status as any)).orderBy(desc(ads.createdAt));
  }

  async getLiveAd(): Promise<Ad | undefined> {
    const now = new Date();
    const liveAds = await db.select().from(ads).where(eq(ads.status, "approved"));
    const valid = liveAds.filter(a => !a.expiresAt || a.expiresAt > now);
    if (valid.length === 0) return undefined;
    return valid[Math.floor(Math.random() * valid.length)];
  }

  async updateAd(id: string, data: Partial<InsertAd & { reviewedAt: Date | null; expiresAt: Date | null; impressions: number }>): Promise<Ad | undefined> {
    const [updated] = await db.update(ads).set(data as any).where(eq(ads.id, id)).returning();
    return updated;
  }

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
  }

  async createAdmin(data: { username: string; passwordHash: string; displayName?: string; createdBy?: string }): Promise<AdminUser> {
    const [created] = await db.insert(adminUsers).values(data).returning();
    return created;
  }

  async getAdminByUsername(username: string): Promise<AdminUser | undefined> {
    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.username, username));
    return admin;
  }

  async getAdminById(id: string): Promise<AdminUser | undefined> {
    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
    return admin;
  }

  async getAllAdmins(): Promise<AdminUser[]> {
    return db.select().from(adminUsers).orderBy(adminUsers.createdAt);
  }

  async getAdminCount(): Promise<number> {
    const all = await db.select().from(adminUsers);
    return all.length;
  }

  async deleteAdmin(id: string): Promise<void> {
    await db.delete(adminUsers).where(eq(adminUsers.id, id));
  }
}

export const storage = new DatabaseStorage();
