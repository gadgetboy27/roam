import { eq, and, or, desc, inArray, gt } from "drizzle-orm";
import { db } from "./db";
import {
  users, photos, matches, messages, bucketList, ads, adminUsers,
  groups, groupMembers, groupMessages, groupEvents, groupEventAttendees, groupInvites, notifications,
  type User, type InsertUser, type Photo, type InsertPhoto,
  type Match, type InsertMatch, type Message, type InsertMessage,
  type BucketListItem, type InsertBucketList, type Ad, type InsertAd,
  type AdminUser, type InsertAdminUser,
  type Group, type InsertGroup, type GroupMember, type InsertGroupMember,
  type GroupMessage, type GroupEvent, type InsertGroupEvent,
  type GroupInvite, type InsertGroupInvite,
  type Notification,
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
  getPublicEventAds(): Promise<Ad[]>;
  updateAd(id: string, data: Partial<InsertAd & { reviewedAt: Date | null; expiresAt: Date | null; impressions: number }>): Promise<Ad | undefined>;

  createAdmin(data: { username: string; passwordHash: string; displayName?: string; createdBy?: string }): Promise<AdminUser>;
  getAdminByUsername(username: string): Promise<AdminUser | undefined>;
  getAdminById(id: string): Promise<AdminUser | undefined>;
  getAllAdmins(): Promise<AdminUser[]>;
  getAdminCount(): Promise<number>;
  deleteAdmin(id: string): Promise<void>;

  createGroup(data: InsertGroup): Promise<Group>;
  getGroup(id: string): Promise<Group | undefined>;
  getAllGroups(): Promise<Group[]>;
  updateGroup(id: string, data: Partial<InsertGroup>): Promise<Group | undefined>;
  deleteGroup(id: string): Promise<void>;

  addGroupMember(data: InsertGroupMember): Promise<GroupMember>;
  getGroupMember(groupId: string, userId: string): Promise<GroupMember | undefined>;
  getGroupMembers(groupId: string): Promise<GroupMember[]>;
  updateGroupMember(id: number, data: Partial<InsertGroupMember>): Promise<GroupMember | undefined>;
  removeGroupMember(groupId: string, userId: string): Promise<void>;
  getGroupsForUser(userId: string): Promise<Group[]>;
  getUserActiveGroupIds(userId: string): Promise<string[]>;

  createGroupMessage(data: { groupId: string; senderId: string; content: string }): Promise<GroupMessage>;
  getGroupMessages(groupId: string, limit?: number): Promise<GroupMessage[]>;

  createGroupEvent(data: InsertGroupEvent): Promise<GroupEvent>;
  getGroupEvents(groupId: string): Promise<GroupEvent[]>;
  getGroupEvent(id: string): Promise<GroupEvent | undefined>;
  deleteGroupEvent(id: string): Promise<void>;

  rsvpEvent(eventId: string, userId: string): Promise<void>;
  unrsvpEvent(eventId: string, userId: string): Promise<void>;
  getEventAttendees(eventId: string): Promise<{ userId: string; name: string; avatarUrl: string | null }[]>;
  getUpcomingEvents(userId?: string): Promise<any[]>;

  createNotification(data: { userId: string; type: string; title: string; body?: string; data?: string }): Promise<Notification>;
  getNotificationsForUser(userId: string, limit?: number): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  markNotificationRead(id: number): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;

  getMatchedUserIds(userId: string): Promise<string[]>;
  getGroupsLedByUser(userId: string): Promise<Group[]>;

  createGroupInvite(data: InsertGroupInvite): Promise<GroupInvite>;
  getGroupInviteByToken(token: string): Promise<GroupInvite | undefined>;
  getGroupInvitesByGroup(groupId: string): Promise<GroupInvite[]>;
  updateGroupInviteStatus(id: string, status: string): Promise<void>;
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

  async getPublicEventAds(): Promise<Ad[]> {
    const now = new Date();
    const rows = await db.select().from(ads)
      .where(and(eq(ads.status, "approved"), eq(ads.adType as any, "event")))
      .orderBy((ads as any).eventStartAt);
    return rows.filter(a => !a.eventStartAt || new Date(a.eventStartAt) > now);
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

  async createGroup(data: InsertGroup): Promise<Group> {
    const [created] = await db.insert(groups).values(data).returning();
    return created;
  }

  async getGroup(id: string): Promise<Group | undefined> {
    const [group] = await db.select().from(groups).where(eq(groups.id, id));
    return group;
  }

  async getAllGroups(): Promise<Group[]> {
    return db.select().from(groups).where(eq(groups.isActive, true)).orderBy(desc(groups.createdAt));
  }

  async updateGroup(id: string, data: Partial<InsertGroup>): Promise<Group | undefined> {
    const [updated] = await db.update(groups).set(data as any).where(eq(groups.id, id)).returning();
    return updated;
  }

  async deleteGroup(id: string): Promise<void> {
    await db.update(groups).set({ isActive: false }).where(eq(groups.id, id));
  }

  async addGroupMember(data: InsertGroupMember): Promise<GroupMember> {
    const [created] = await db.insert(groupMembers).values(data).returning();
    return created;
  }

  async getGroupMember(groupId: string, userId: string): Promise<GroupMember | undefined> {
    const [member] = await db.select().from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
    return member;
  }

  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    return db.select().from(groupMembers).where(eq(groupMembers.groupId, groupId));
  }

  async updateGroupMember(id: number, data: Partial<InsertGroupMember>): Promise<GroupMember | undefined> {
    const [updated] = await db.update(groupMembers).set(data as any).where(eq(groupMembers.id, id)).returning();
    return updated;
  }

  async removeGroupMember(groupId: string, userId: string): Promise<void> {
    await db.delete(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
  }

  async getGroupsForUser(userId: string): Promise<Group[]> {
    const memberships = await db.select().from(groupMembers)
      .where(and(eq(groupMembers.userId, userId), eq(groupMembers.status, "approved")));
    if (memberships.length === 0) return [];
    const groupIds = memberships.map(m => m.groupId);
    return db.select().from(groups).where(and(inArray(groups.id, groupIds), eq(groups.isActive, true)));
  }

  async getUserActiveGroupIds(userId: string): Promise<string[]> {
    const memberships = await db.select().from(groupMembers)
      .where(and(eq(groupMembers.userId, userId), eq(groupMembers.status, "approved")));
    return memberships.map(m => m.groupId);
  }

  async createGroupMessage(data: { groupId: string; senderId: string; content: string }): Promise<GroupMessage> {
    const [created] = await db.insert(groupMessages).values(data).returning();
    return created;
  }

  async getGroupMessages(groupId: string, limit = 100): Promise<GroupMessage[]> {
    const rows = await db.select().from(groupMessages)
      .where(eq(groupMessages.groupId, groupId))
      .orderBy(desc(groupMessages.createdAt))
      .limit(limit);
    return rows.reverse();
  }

  async createGroupEvent(data: InsertGroupEvent): Promise<GroupEvent> {
    const [created] = await db.insert(groupEvents).values(data).returning();
    return created;
  }

  async getGroupEvents(groupId: string): Promise<GroupEvent[]> {
    return db.select().from(groupEvents)
      .where(eq(groupEvents.groupId, groupId))
      .orderBy(groupEvents.startAt);
  }

  async getGroupEvent(id: string): Promise<GroupEvent | undefined> {
    const [event] = await db.select().from(groupEvents).where(eq(groupEvents.id, id));
    return event;
  }

  async deleteGroupEvent(id: string): Promise<void> {
    await db.delete(groupEvents).where(eq(groupEvents.id, id));
  }

  async rsvpEvent(eventId: string, userId: string): Promise<void> {
    const existing = await db.select().from(groupEventAttendees)
      .where(and(eq(groupEventAttendees.eventId, eventId), eq(groupEventAttendees.userId, userId)));
    if (existing.length === 0) {
      await db.insert(groupEventAttendees).values({ eventId, userId });
    }
  }

  async unrsvpEvent(eventId: string, userId: string): Promise<void> {
    await db.delete(groupEventAttendees)
      .where(and(eq(groupEventAttendees.eventId, eventId), eq(groupEventAttendees.userId, userId)));
  }

  async getEventAttendees(eventId: string): Promise<{ userId: string; name: string; avatarUrl: string | null }[]> {
    const rows = await db
      .select({ userId: groupEventAttendees.userId, name: users.name, avatarUrl: users.avatarUrl })
      .from(groupEventAttendees)
      .innerJoin(users, eq(groupEventAttendees.userId, users.id))
      .where(eq(groupEventAttendees.eventId, eventId));
    return rows;
  }

  async getUpcomingEvents(userId?: string): Promise<any[]> {
    const now = new Date();
    const rows = await db
      .select({ event: groupEvents, group: groups })
      .from(groupEvents)
      .innerJoin(groups, eq(groupEvents.groupId, groups.id))
      .where(and(gt(groupEvents.startAt, now), eq(groups.isActive, true)))
      .orderBy(groupEvents.startAt);

    if (rows.length === 0) return [];

    const eventIds = rows.map(r => r.event.id);
    const allAttendees = await db
      .select({ eventId: groupEventAttendees.eventId, userId: groupEventAttendees.userId, name: users.name, avatarUrl: users.avatarUrl })
      .from(groupEventAttendees)
      .innerJoin(users, eq(groupEventAttendees.userId, users.id))
      .where(inArray(groupEventAttendees.eventId, eventIds));

    let myGroupIds: string[] = [];
    if (userId) {
      const memberships = await db.select({ groupId: groupMembers.groupId })
        .from(groupMembers)
        .where(and(eq(groupMembers.userId, userId), eq(groupMembers.status, "approved")));
      myGroupIds = memberships.map(m => m.groupId);
    }

    return rows.map(r => {
      const attendees = allAttendees.filter(a => a.eventId === r.event.id);
      return {
        ...r.event,
        group: { id: r.group.id, name: r.group.name, type: r.group.type, location: r.group.location, visibility: r.group.visibility, adventureTags: r.group.adventureTags },
        rsvpCount: attendees.length,
        attendeeFaces: attendees.slice(0, 3).map(a => ({ userId: a.userId, name: a.name, avatarUrl: a.avatarUrl })),
        isRsvpd: userId ? attendees.some(a => a.userId === userId) : false,
        isMember: userId ? myGroupIds.includes(r.group.id) : false,
      };
    });
  }

  async createNotification(data: { userId: string; type: string; title: string; body?: string; data?: string }): Promise<Notification> {
    const [created] = await db.insert(notifications).values(data).returning();
    return created;
  }

  async getNotificationsForUser(userId: string, limit = 30): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const rows = await db.select().from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return rows.length;
  }

  async markNotificationRead(id: number): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
  }

  async getMatchedUserIds(userId: string): Promise<string[]> {
    const rows = await db.select().from(matches).where(
      and(
        or(eq(matches.userAId, userId), eq(matches.userBId, userId)),
        eq(matches.status, "matched")
      )
    );
    return rows.map(m => m.userAId === userId ? m.userBId : m.userAId);
  }

  async getGroupsLedByUser(userId: string): Promise<Group[]> {
    return db.select().from(groups).where(and(eq(groups.leaderId, userId), eq(groups.isActive, true)));
  }

  async createGroupInvite(data: InsertGroupInvite): Promise<GroupInvite> {
    const [created] = await db.insert(groupInvites).values(data).returning();
    return created;
  }

  async getGroupInviteByToken(token: string): Promise<GroupInvite | undefined> {
    const [invite] = await db.select().from(groupInvites).where(eq(groupInvites.token, token));
    return invite;
  }

  async getGroupInvitesByGroup(groupId: string): Promise<GroupInvite[]> {
    return db.select().from(groupInvites)
      .where(eq(groupInvites.groupId, groupId))
      .orderBy(desc(groupInvites.createdAt));
  }

  async updateGroupInviteStatus(id: string, status: string): Promise<void> {
    await db.update(groupInvites).set({ status }).where(eq(groupInvites.id, id));
  }
}

export const storage = new DatabaseStorage();
