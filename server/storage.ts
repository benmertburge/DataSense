import {
  users,
  stopAreas,
  stopPoints,
  lines,
  savedRoutes,
  commuteRoutes,
  journeys,
  compensationCases,
  deviations,
  userNotifications,
  pushSubscriptions,
  serviceAlerts,
  type User,
  type UpsertUser,
  type StopArea,
  type StopPoint,
  type Line,
  type SavedRoute,
  type CommuteRoute,
  type Journey,
  type CompensationCase,
  type Deviation,
  type UserNotification,
  type PushSubscription,
  type ServiceAlert,
  type InsertSavedRoute,
  type InsertCommuteRoute,
  type InsertJourney,
  type InsertCompensationCase,
  type InsertUserNotification,
  type InsertPushSubscription,
  type InsertServiceAlert,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Stop and line operations
  getStopArea(id: string): Promise<StopArea | undefined>;
  searchStopAreas(query: string): Promise<StopArea[]>;
  getStopPoints(areaId: string): Promise<StopPoint[]>;
  getLine(id: string): Promise<Line | undefined>;
  getLines(): Promise<Line[]>;
  
  // Saved routes
  getUserSavedRoutes(userId: string): Promise<SavedRoute[]>;
  createSavedRoute(route: InsertSavedRoute): Promise<SavedRoute>;
  deleteSavedRoute(id: string, userId: string): Promise<void>;
  
  // Commute routes (daily tracking with weekdays)
  getUserCommuteRoutes(userId: string): Promise<CommuteRoute[]>;
  createCommuteRoute(route: InsertCommuteRoute): Promise<CommuteRoute>;
  updateCommuteRoute(id: string, updates: Partial<CommuteRoute>): Promise<CommuteRoute>;
  deleteCommuteRoute(id: string, userId: string): Promise<void>;
  getActiveCommuteRoutesForDay(userId: string, dayOfWeek: string): Promise<CommuteRoute[]>;
  
  // Journeys
  getUserJourneys(userId: string, limit?: number): Promise<Journey[]>;
  createJourney(journey: InsertJourney): Promise<Journey>;
  updateJourney(id: string, updates: Partial<Journey>): Promise<Journey>;
  getActiveJourney(userId: string): Promise<Journey | undefined>;
  
  // Compensation cases
  getUserCompensationCases(userId: string): Promise<CompensationCase[]>;
  createCompensationCase(compensationCase: InsertCompensationCase): Promise<CompensationCase>;
  updateCompensationCase(id: string, updates: Partial<CompensationCase>): Promise<CompensationCase>;
  getCompensationCase(id: string): Promise<CompensationCase | undefined>;
  
  // Deviations
  getActiveDeviations(): Promise<Deviation[]>;
  getDeviationsForAreas(areaIds: string[]): Promise<Deviation[]>;
  getDeviationsForLines(lineIds: string[]): Promise<Deviation[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // User settings operations
  async updateUserSettings(userId: string, updates: Partial<User>): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  // Notification operations
  async getUserNotifications(userId: string): Promise<UserNotification[]> {
    return await db
      .select()
      .from(userNotifications)
      .where(eq(userNotifications.userId, userId))
      .orderBy(desc(userNotifications.createdAt));
  }

  async createNotification(data: InsertUserNotification): Promise<UserNotification> {
    const [notification] = await db
      .insert(userNotifications)
      .values(data)
      .returning();
    return notification;
  }

  async markNotificationAsRead(userId: string, notificationId: string): Promise<UserNotification | null> {
    const [updated] = await db
      .update(userNotifications)
      .set({ isRead: true })
      .where(and(
        eq(userNotifications.id, notificationId),
        eq(userNotifications.userId, userId)
      ))
      .returning();
    return updated || null;
  }

  // Service alerts operations
  async getActiveServiceAlerts(): Promise<ServiceAlert[]> {
    return await db
      .select()
      .from(serviceAlerts)
      .where(eq(serviceAlerts.isActive, true))
      .orderBy(desc(serviceAlerts.createdAt));
  }

  // Push subscription operations
  async createPushSubscription(data: InsertPushSubscription): Promise<PushSubscription> {
    const [subscription] = await db
      .insert(pushSubscriptions)
      .values(data)
      .returning();
    return subscription;
  }

  async deletePushSubscription(userId: string, endpoint: string): Promise<boolean> {
    const result = await db
      .delete(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint)
      ));
    return (result.rowCount || 0) > 0;
  }

  // Enhanced commute route operations
  async getUserCommuteRoutes(userId: string): Promise<CommuteRoute[]> {
    return await db.select().from(commuteRoutes).where(eq(commuteRoutes.userId, userId));
  }

  async getActiveCommuteRoutesForDay(userId: string, dayOfWeek: string): Promise<CommuteRoute[]> {
    const dayColumn = dayOfWeek.toLowerCase() as keyof Pick<CommuteRoute, 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'>;
    
    return await db
      .select()
      .from(commuteRoutes)
      .where(
        and(
          eq(commuteRoutes.userId, userId),
          eq(commuteRoutes.isActive, true),
          eq(commuteRoutes[dayColumn], true)
        )
      );
  }

  async updateCommuteRoute(id: string, updates: Partial<CommuteRoute>): Promise<CommuteRoute> {
    const [updated] = await db
      .update(commuteRoutes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(commuteRoutes.id, id))
      .returning();
    return updated;
  }

  async deleteCommuteRoute(id: string, userId: string): Promise<void> {
    await db
      .delete(commuteRoutes)
      .where(and(
        eq(commuteRoutes.id, id),
        eq(commuteRoutes.userId, userId)
      ));
  }

  async getUsersWithActiveJourneys(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .innerJoin(journeys, eq(users.id, journeys.userId))
      .where(eq(journeys.status, 'active'));
  }

  // Stop and line operations
  async getStopArea(id: string): Promise<StopArea | undefined> {
    const [stopArea] = await db.select().from(stopAreas).where(eq(stopAreas.id, id));
    return stopArea;
  }

  async searchStopAreas(query: string): Promise<StopArea[]> {
    return await db.select().from(stopAreas)
      .where(sql`${stopAreas.name} ILIKE ${`%${query}%`}`)
      .limit(10);
  }

  async getStopPoints(areaId: string): Promise<StopPoint[]> {
    return await db.select().from(stopPoints).where(eq(stopPoints.areaId, areaId));
  }

  async getLine(id: string): Promise<Line | undefined> {
    const [line] = await db.select().from(lines).where(eq(lines.id, id));
    return line;
  }

  async getLines(): Promise<Line[]> {
    return await db.select().from(lines);
  }

  // Saved routes
  async getUserSavedRoutes(userId: string): Promise<SavedRoute[]> {
    return await db.select().from(savedRoutes)
      .where(and(eq(savedRoutes.userId, userId), eq(savedRoutes.isActive, true)))
      .orderBy(desc(savedRoutes.createdAt));
  }

  async createSavedRoute(route: InsertSavedRoute): Promise<SavedRoute> {
    const [savedRoute] = await db.insert(savedRoutes).values(route).returning();
    return savedRoute;
  }

  async deleteSavedRoute(id: string, userId: string): Promise<void> {
    await db.update(savedRoutes)
      .set({ isActive: false })
      .where(and(eq(savedRoutes.id, id), eq(savedRoutes.userId, userId)));
  }

  // Commute routes implementation
  async getUserCommuteRoutes(userId: string): Promise<CommuteRoute[]> {
    return await db.select().from(commuteRoutes).where(eq(commuteRoutes.userId, userId));
  }

  async createCommuteRoute(route: InsertCommuteRoute): Promise<CommuteRoute> {
    const [newRoute] = await db.insert(commuteRoutes).values(route).returning();
    return newRoute;
  }

  // Legacy method kept for compatibility
  async updateCommuteRoute(id: string, updates: Partial<CommuteRoute>): Promise<CommuteRoute> {
    const [updatedRoute] = await db
      .update(commuteRoutes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(commuteRoutes.id, id))
      .returning();
    return updatedRoute;
  }



  async getActiveCommuteRoutesForDay(userId: string, dayOfWeek: string): Promise<CommuteRoute[]> {
    const dayColumn = dayOfWeek.toLowerCase() as keyof typeof commuteRoutes;
    return await db
      .select()
      .from(commuteRoutes)
      .where(
        and(
          eq(commuteRoutes.userId, userId),
          eq(commuteRoutes.isActive, true),
          eq(commuteRoutes[dayColumn], true)
        )
      );
  }

  // Journeys
  async getUserJourneys(userId: string, limit = 20): Promise<Journey[]> {
    return await db.select().from(journeys)
      .where(eq(journeys.userId, userId))
      .orderBy(desc(journeys.createdAt))
      .limit(limit);
  }

  async createJourney(journey: InsertJourney): Promise<Journey> {
    const [newJourney] = await db.insert(journeys).values(journey).returning();
    return newJourney;
  }

  async updateJourney(id: string, updates: Partial<Journey>): Promise<Journey> {
    const [updatedJourney] = await db.update(journeys)
      .set(updates)
      .where(eq(journeys.id, id))
      .returning();
    return updatedJourney;
  }

  async getActiveJourney(userId: string): Promise<Journey | undefined> {
    const [journey] = await db.select().from(journeys)
      .where(and(
        eq(journeys.userId, userId),
        eq(journeys.status, "active")
      ))
      .orderBy(desc(journeys.createdAt))
      .limit(1);
    return journey;
  }

  // Compensation cases
  async getUserCompensationCases(userId: string): Promise<CompensationCase[]> {
    return await db.select().from(compensationCases)
      .where(eq(compensationCases.userId, userId))
      .orderBy(desc(compensationCases.createdAt));
  }

  async createCompensationCase(compensationCase: InsertCompensationCase): Promise<CompensationCase> {
    const [newCase] = await db.insert(compensationCases).values(compensationCase).returning();
    return newCase;
  }

  async updateCompensationCase(id: string, updates: Partial<CompensationCase>): Promise<CompensationCase> {
    const [updatedCase] = await db.update(compensationCases)
      .set(updates)
      .where(eq(compensationCases.id, id))
      .returning();
    return updatedCase;
  }

  async getCompensationCase(id: string): Promise<CompensationCase | undefined> {
    const [compensationCase] = await db.select().from(compensationCases).where(eq(compensationCases.id, id));
    return compensationCase;
  }

  // Deviations
  async getActiveDeviations(): Promise<Deviation[]> {
    const now = new Date();
    return await db.select().from(deviations)
      .where(and(
        eq(deviations.isActive, true),
        gte(deviations.validTo, now)
      ))
      .orderBy(desc(deviations.lastUpdated));
  }

  async getDeviationsForAreas(areaIds: string[]): Promise<Deviation[]> {
    const now = new Date();
    return await db.select().from(deviations)
      .where(and(
        eq(deviations.isActive, true),
        gte(deviations.validTo, now),
        sql`${deviations.affectedAreaIds} && ${areaIds}`
      ));
  }

  async getDeviationsForLines(lineIds: string[]): Promise<Deviation[]> {
    const now = new Date();
    return await db.select().from(deviations)
      .where(and(
        eq(deviations.isActive, true),
        gte(deviations.validTo, now),
        sql`${deviations.affectedLineIds} && ${lineIds}`
      ));
  }
}

export const storage = new DatabaseStorage();
