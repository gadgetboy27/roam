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

export const messagesRepo = {
  async createMessage(message: InsertMessage): Promise<Message> {
    const [created] = await db.insert(messages).values(message).returning();
    return created;
  },

  async getMessagesByMatch(matchId: string): Promise<Message[]> {
    return db.select().from(messages).where(eq(messages.matchId, matchId)).orderBy(messages.createdAt);
  },

  // One row per conversation the user is in that has messages: the latest
  // message (content/sender/time) + how many are unread for this user. Powers
  // the inbox list (recency ordering, last-message preview, unread badges)
  // without the client fetching every thread.
  async getInboxSummary(userId: string): Promise<
    { matchId: string; content: string; senderId: string; createdAt: string; unread: number }[]
  > {
    const result = await db.execute(sql`
      WITH my_matches AS (
        SELECT id FROM matches
        WHERE (user_a_id = ${userId} OR user_b_id = ${userId}) AND status = 'matched'
      ),
      last_msg AS (
        SELECT DISTINCT ON (match_id) match_id, content, sender_id, created_at
        FROM messages
        WHERE match_id IN (SELECT id FROM my_matches)
        ORDER BY match_id, created_at DESC
      ),
      unread AS (
        SELECT match_id, COUNT(*)::int AS cnt
        FROM messages
        WHERE match_id IN (SELECT id FROM my_matches) AND sender_id <> ${userId} AND read = false
        GROUP BY match_id
      )
      SELECT lm.match_id AS "matchId", lm.content, lm.sender_id AS "senderId",
             lm.created_at AS "createdAt", COALESCE(u.cnt, 0)::int AS unread
      FROM last_msg lm
      LEFT JOIN unread u ON u.match_id = lm.match_id
    `);
    return ((result as any).rows ?? []) as any;
  },

};
