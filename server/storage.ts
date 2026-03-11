import { eq, and, or, desc } from "drizzle-orm";
import { db } from "./db";
import {
  users, photos, matches, messages, bucketList,
  type User, type InsertUser, type Photo, type InsertPhoto,
  type Match, type InsertMatch, type Message, type InsertMessage,
  type BucketListItem, type InsertBucketList,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;

  createPhoto(photo: InsertPhoto): Promise<Photo>;
  getPhotosByUser(userId: string): Promise<Photo[]>;

  createMatch(match: InsertMatch): Promise<Match>;
  getMatchesForUser(userId: string): Promise<Match[]>;
  updateMatchStatus(id: string, status: string): Promise<Match | undefined>;

  createMessage(message: InsertMessage): Promise<Message>;
  getMessagesByMatch(matchId: string): Promise<Message[]>;

  createBucketItem(item: InsertBucketList): Promise<BucketListItem>;
  getBucketListByUser(userId: string): Promise<BucketListItem[]>;
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

  async createMatch(match: InsertMatch): Promise<Match> {
    const [created] = await db.insert(matches).values(match).returning();
    return created;
  }

  async getMatchesForUser(userId: string): Promise<Match[]> {
    return db.select().from(matches).where(
      or(eq(matches.userAId, userId), eq(matches.userBId, userId))
    ).orderBy(desc(matches.createdAt));
  }

  async updateMatchStatus(id: string, status: string): Promise<Match | undefined> {
    const [updated] = await db.update(matches).set({ status: status as any }).where(eq(matches.id, id)).returning();
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
}

export const storage = new DatabaseStorage();
