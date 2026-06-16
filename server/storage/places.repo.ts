import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { visitedPlaces, type VisitedPlace, type InsertVisitedPlace } from "@shared/schema";

export const placesRepo = {
  async createVisitedPlace(item: InsertVisitedPlace): Promise<VisitedPlace> {
    const [created] = await db.insert(visitedPlaces).values(item).returning();
    return created;
  },

  async getVisitedPlace(id: string): Promise<VisitedPlace | undefined> {
    const [item] = await db.select().from(visitedPlaces).where(eq(visitedPlaces.id, id));
    return item;
  },

  async getVisitedPlacesByUser(userId: string): Promise<VisitedPlace[]> {
    return db.select().from(visitedPlaces).where(eq(visitedPlaces.userId, userId));
  },

  // Batch fetch for the Discover feed (avoids N+1 when computing Almost Met).
  async getVisitedPlacesForUsers(userIds: string[]): Promise<VisitedPlace[]> {
    if (userIds.length === 0) return [];
    return db.select().from(visitedPlaces).where(inArray(visitedPlaces.userId, userIds));
  },

  async deleteVisitedPlace(id: string): Promise<void> {
    await db.delete(visitedPlaces).where(eq(visitedPlaces.id, id));
  },
};
