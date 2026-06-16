import {
  users, photos, matches, messages, bucketList, ads, adminUsers, adminAuditLog,
  groups, groupMembers, groupMessages, groupEvents, groupEventAttendees, groupInvites, notifications,
  type User, type InsertUser, type Photo, type InsertPhoto,
  type Match, type InsertMatch, type Message, type InsertMessage,
  type BucketListItem, type InsertBucketList, type Ad, type InsertAd,
  type VisitedPlace, type InsertVisitedPlace,
  type AdminUser, type InsertAdminUser,
  type Group, type InsertGroup, type GroupMember, type InsertGroupMember,
  type GroupMessage, type GroupEvent, type InsertGroupEvent,
  type GroupInvite, type InsertGroupInvite,
  type Notification,
  type AdminAuditLog, type InsertAdminAuditLog,
} from "@shared/schema";

import { usersRepo } from "./storage/users.repo";
import { photosRepo } from "./storage/photos.repo";
import { matchesRepo } from "./storage/matches.repo";
import { messagesRepo } from "./storage/messages.repo";
import { bucketListRepo } from "./storage/bucketList.repo";
import { placesRepo } from "./storage/places.repo";
import { adsRepo } from "./storage/ads.repo";
import { adminRepo } from "./storage/admin.repo";
import { groupsRepo } from "./storage/groups.repo";
import { notificationsRepo } from "./storage/notifications.repo";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUsersByIds(ids: string[]): Promise<User[]>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  countFoundingMembers(): Promise<number>;
  getUserByStripeCustomerId(customerId: string): Promise<User | undefined>;

  createPhoto(photo: InsertPhoto): Promise<Photo>;
  getPhotosByUser(userId: string): Promise<Photo[]>;
  getHeroPhoto(userId: string): Promise<{ url: string } | undefined>;
  getFirstApprovedPhotoPerUser(): Promise<Record<string, string>>;

  createMatch(match: InsertMatch): Promise<Match>;
  getMatchById(id: string): Promise<Match | undefined>;
  getMatchesForUser(userId: string): Promise<Match[]>;
  getMatchBetween(userAId: string, userBId: string): Promise<Match | undefined>;
  updateMatchStatus(id: string, status: string, extra?: Partial<InsertMatch>): Promise<Match | undefined>;
  getMonthlyConnectionsSent(userId: string): Promise<number>;

  createMessage(message: InsertMessage): Promise<Message>;
  getMessagesByMatch(matchId: string): Promise<Message[]>;

  createBucketItem(item: InsertBucketList): Promise<BucketListItem>;
  getBucketItem(id: string): Promise<BucketListItem | undefined>;
  getBucketListByUser(userId: string): Promise<BucketListItem[]>;
  deleteBucketItem(id: string): Promise<void>;

  createVisitedPlace(item: InsertVisitedPlace): Promise<VisitedPlace>;
  getVisitedPlace(id: string): Promise<VisitedPlace | undefined>;
  getVisitedPlacesByUser(userId: string): Promise<VisitedPlace[]>;
  getVisitedPlacesForUsers(userIds: string[]): Promise<VisitedPlace[]>;
  deleteVisitedPlace(id: string): Promise<void>;

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
  getGroupMembersForGroups(groupIds: string[]): Promise<GroupMember[]>;
  updateGroupMember(id: number, data: Partial<InsertGroupMember>): Promise<GroupMember | undefined>;
  removeGroupMember(groupId: string, userId: string): Promise<void>;
  getGroupsForUser(userId: string): Promise<Group[]>;
  getUserActiveGroupIds(userId: string): Promise<string[]>;

  createGroupMessage(data: { groupId: string; senderId: string; content: string; isAnnouncement?: boolean }): Promise<GroupMessage>;
  getGroupMessages(groupId: string, limit?: number): Promise<GroupMessage[]>;

  createGroupEvent(data: InsertGroupEvent): Promise<GroupEvent>;
  getGroupEvents(groupId: string): Promise<GroupEvent[]>;
  getGroupEvent(id: string): Promise<GroupEvent | undefined>;
  deleteGroupEvent(id: string): Promise<void>;

  rsvpEvent(eventId: string, userId: string): Promise<void>;
  rsvpEventTicketed(eventId: string, userId: string, sessionId: string): Promise<void>;
  unrsvpEvent(eventId: string, userId: string): Promise<void>;
  getEventAttendee(eventId: string, userId: string): Promise<typeof groupEventAttendees.$inferSelect | undefined>;
  markTicketPaid(attendeeId: number, sessionId: string): Promise<void>;
  getEventAttendees(eventId: string): Promise<{ userId: string; name: string; avatarUrl: string | null }[]>;
  getUpcomingEvents(userId?: string): Promise<any[]>;

  createNotification(data: { userId: string; type: string; title: string; body?: string; data?: string }): Promise<Notification>;
  getNotificationsForUser(userId: string, limit?: number): Promise<Notification[]>;
  findUnreadNotification(userId: string, type: string, dataKey: string, dataValue: string): Promise<Notification | undefined>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  getNotificationById(id: number): Promise<Notification | undefined>;
  markNotificationRead(id: number): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;

  getMatchedUserIds(userId: string): Promise<string[]>;
  getInteractedUserIds(userId: string): Promise<string[]>;
  createPass(userAId: string, userBId: string): Promise<void>;
  getAllPhotosForUsers(userIds: string[]): Promise<Record<string, Photo[]>>;
  createAuditLog(data: InsertAdminAuditLog): Promise<AdminAuditLog>;
  getAuditLogs(limit?: number): Promise<AdminAuditLog[]>;
  getGroupsLedByUser(userId: string): Promise<Group[]>;

  createGroupInvite(data: InsertGroupInvite): Promise<GroupInvite>;
  getGroupInviteByToken(token: string): Promise<GroupInvite | undefined>;
  getGroupInvitesByGroup(groupId: string): Promise<GroupInvite[]>;
  updateGroupInviteStatus(id: string, status: string): Promise<void>;
}

// Composed storage facade — implementation lives in server/storage/*.repo.ts.
// Public API is unchanged; IStorage guarantees all methods are present.
export const storage: IStorage = {
  ...usersRepo, ...photosRepo, ...matchesRepo, ...messagesRepo, ...bucketListRepo,
  ...placesRepo, ...adsRepo, ...adminRepo, ...groupsRepo, ...notificationsRepo,
};
