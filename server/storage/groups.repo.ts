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

export const groupsRepo = {
  async createGroup(data: InsertGroup): Promise<Group> {
    const [created] = await db.insert(groups).values(data).returning();
    return created;
  },

  async getGroup(id: string): Promise<Group | undefined> {
    const [group] = await db.select().from(groups).where(eq(groups.id, id));
    return group;
  },

  async getAllGroups(): Promise<Group[]> {
    return db.select().from(groups).where(eq(groups.isActive, true)).orderBy(desc(groups.createdAt));
  },

  async updateGroup(id: string, data: Partial<InsertGroup>): Promise<Group | undefined> {
    const [updated] = await db.update(groups).set(data as any).where(eq(groups.id, id)).returning();
    return updated;
  },

  async deleteGroup(id: string): Promise<void> {
    await db.update(groups).set({ isActive: false }).where(eq(groups.id, id));
  },

  async addGroupMember(data: InsertGroupMember): Promise<GroupMember> {
    const [created] = await db.insert(groupMembers).values(data).returning();
    return created;
  },

  async getGroupMember(groupId: string, userId: string): Promise<GroupMember | undefined> {
    const [member] = await db.select().from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
    return member;
  },

  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    return db.select().from(groupMembers).where(eq(groupMembers.groupId, groupId));
  },

  // Batch fetch members for many groups in one query (avoids N+1 in /api/groups).
  async getGroupMembersForGroups(groupIds: string[]): Promise<GroupMember[]> {
    if (groupIds.length === 0) return [];
    return db.select().from(groupMembers).where(inArray(groupMembers.groupId, groupIds));
  },

  async updateGroupMember(id: number, data: Partial<InsertGroupMember>): Promise<GroupMember | undefined> {
    const [updated] = await db.update(groupMembers).set(data as any).where(eq(groupMembers.id, id)).returning();
    return updated;
  },

  async removeGroupMember(groupId: string, userId: string): Promise<void> {
    await db.delete(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
  },

  async getGroupsForUser(userId: string): Promise<Group[]> {
    const memberships = await db.select().from(groupMembers)
      .where(and(eq(groupMembers.userId, userId), eq(groupMembers.status, "approved")));
    if (memberships.length === 0) return [];
    const groupIds = memberships.map(m => m.groupId);
    return db.select().from(groups).where(and(inArray(groups.id, groupIds), eq(groups.isActive, true)));
  },

  async getUserActiveGroupIds(userId: string): Promise<string[]> {
    const memberships = await db.select().from(groupMembers)
      .where(and(eq(groupMembers.userId, userId), eq(groupMembers.status, "approved")));
    return memberships.map(m => m.groupId);
  },

  async createGroupMessage(data: { groupId: string; senderId: string; content: string; isAnnouncement?: boolean }): Promise<GroupMessage> {
    const [created] = await db.insert(groupMessages).values(data).returning();
    return created;
  },

  async getGroupMessages(groupId: string, limit = 100): Promise<GroupMessage[]> {
    const rows = await db.select().from(groupMessages)
      .where(eq(groupMessages.groupId, groupId))
      .orderBy(desc(groupMessages.createdAt))
      .limit(limit);
    return rows.reverse();
  },

  async createGroupEvent(data: InsertGroupEvent): Promise<GroupEvent> {
    const [created] = await db.insert(groupEvents).values(data).returning();
    return created;
  },

  async getGroupEvents(groupId: string): Promise<GroupEvent[]> {
    return db.select().from(groupEvents)
      .where(eq(groupEvents.groupId, groupId))
      .orderBy(groupEvents.startAt);
  },

  async getGroupEvent(id: string): Promise<GroupEvent | undefined> {
    const [event] = await db.select().from(groupEvents).where(eq(groupEvents.id, id));
    return event;
  },

  async deleteGroupEvent(id: string): Promise<void> {
    await db.delete(groupEvents).where(eq(groupEvents.id, id));
  },

  async rsvpEvent(eventId: string, userId: string): Promise<void> {
    const existing = await db.select().from(groupEventAttendees)
      .where(and(eq(groupEventAttendees.eventId, eventId), eq(groupEventAttendees.userId, userId)));
    if (existing.length === 0) {
      await db.insert(groupEventAttendees).values({ eventId, userId, ticketPaid: true });
    }
  },

  async rsvpEventTicketed(eventId: string, userId: string, sessionId: string): Promise<void> {
    await db.insert(groupEventAttendees).values({ eventId, userId, ticketPaid: true, ticketSessionId: sessionId });
  },

  async unrsvpEvent(eventId: string, userId: string): Promise<void> {
    await db.delete(groupEventAttendees)
      .where(and(eq(groupEventAttendees.eventId, eventId), eq(groupEventAttendees.userId, userId)));
  },

  async getEventAttendee(eventId: string, userId: string): Promise<typeof groupEventAttendees.$inferSelect | undefined> {
    const [row] = await db.select().from(groupEventAttendees)
      .where(and(eq(groupEventAttendees.eventId, eventId), eq(groupEventAttendees.userId, userId)));
    return row;
  },

  async markTicketPaid(attendeeId: number, sessionId: string): Promise<void> {
    await db.update(groupEventAttendees)
      .set({ ticketPaid: true, ticketSessionId: sessionId })
      .where(eq(groupEventAttendees.id, attendeeId));
  },

  async getEventAttendees(eventId: string): Promise<{ userId: string; name: string; avatarUrl: string | null }[]> {
    const rows = await db
      .select({ userId: groupEventAttendees.userId, name: users.name, avatarUrl: users.avatarUrl })
      .from(groupEventAttendees)
      .innerJoin(users, eq(groupEventAttendees.userId, users.id))
      .where(eq(groupEventAttendees.eventId, eventId));
    return rows;
  },

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
  },

  async getGroupsLedByUser(userId: string): Promise<Group[]> {
    return db.select().from(groups).where(and(eq(groups.leaderId, userId), eq(groups.isActive, true)));
  },

  async createGroupInvite(data: InsertGroupInvite): Promise<GroupInvite> {
    const [created] = await db.insert(groupInvites).values(data).returning();
    return created;
  },

  async getGroupInviteByToken(token: string): Promise<GroupInvite | undefined> {
    const [invite] = await db.select().from(groupInvites).where(eq(groupInvites.token, token));
    return invite;
  },

  async getGroupInvitesByGroup(groupId: string): Promise<GroupInvite[]> {
    return db.select().from(groupInvites)
      .where(eq(groupInvites.groupId, groupId))
      .orderBy(desc(groupInvites.createdAt));
  },

  async updateGroupInviteStatus(id: string, status: string): Promise<void> {
    await db.update(groupInvites).set({ status }).where(eq(groupInvites.id, id));
  },
};
