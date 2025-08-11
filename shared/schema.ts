import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // Transit-specific fields
  notificationsEnabled: boolean("notifications_enabled").default(true),
  delayAlertsEnabled: boolean("delay_alerts_enabled").default(true),
  alertTimingMinutes: integer("alert_timing_minutes").default(15),
  // Personal preferences
  preferredLanguage: varchar("preferred_language").default("sv"),
  theme: varchar("theme").default("light"),
  pushNotifications: boolean("push_notifications").default(false),
  emailNotifications: boolean("email_notifications").default(true),
  smsNotifications: boolean("sms_notifications").default(false),
  phone: varchar("phone"),
  address: text("address"),
  emergencyContact: varchar("emergency_contact"),
});

export const stopAreas = pgTable("stop_areas", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  lat: decimal("lat", { precision: 10, scale: 7 }),
  lon: decimal("lon", { precision: 10, scale: 7 }),
  type: varchar("type", { enum: ["METROSTN", "RAILWSTN", "BUSTERM", "TRAMSTN", "FERRY", "OTHER"] }),
});

export const stopPoints = pgTable("stop_points", {
  id: varchar("id").primaryKey(),
  areaId: varchar("area_id").references(() => stopAreas.id).notNull(),
  name: varchar("name"),
  designation: varchar("designation"), // platform/track number
});

export const lines = pgTable("lines", {
  id: varchar("id").primaryKey(),
  number: varchar("number").notNull(),
  mode: varchar("mode", { enum: ["BUS", "METRO", "TRAIN", "TRAM", "FERRY"] }).notNull(),
  name: varchar("name"),
  operatorId: varchar("operator_id"),
  color: varchar("color").default("#666666"),
});

export const savedRoutes = pgTable("saved_routes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: varchar("name").notNull(),
  originAreaId: varchar("origin_area_id").references(() => stopAreas.id).notNull(),
  destinationAreaId: varchar("destination_area_id").references(() => stopAreas.id).notNull(),
  viaAreaId: varchar("via_area_id").references(() => stopAreas.id),
  preferredDepartureTime: varchar("preferred_departure_time"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Daily commute tracking for regular transit users
export const commuteRoutes = pgTable("commute_routes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: varchar("name").notNull(),
  originAreaId: varchar("origin_area_id").references(() => stopAreas.id).notNull(),
  originName: varchar("origin_name"),
  destinationAreaId: varchar("destination_area_id").references(() => stopAreas.id).notNull(),
  destinationName: varchar("destination_name"),
  departureTime: varchar("departure_time").notNull(), // HH:MM format
  // Weekday selection - true means active on that day
  monday: boolean("monday").default(false),
  tuesday: boolean("tuesday").default(false),
  wednesday: boolean("wednesday").default(false),
  thursday: boolean("thursday").default(false),
  friday: boolean("friday").default(false),
  saturday: boolean("saturday").default(false),
  sunday: boolean("sunday").default(false),
  // Notification settings
  notificationsEnabled: boolean("notifications_enabled").default(true),
  alertMinutesBefore: integer("alert_minutes_before").default(15),
  delayThresholdMinutes: integer("delay_threshold_minutes").default(20),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const journeys = pgTable("journeys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  routeId: varchar("route_id").references(() => savedRoutes.id),
  plannedDeparture: timestamp("planned_departure").notNull(),
  plannedArrival: timestamp("planned_arrival").notNull(),
  expectedDeparture: timestamp("expected_departure"),
  expectedArrival: timestamp("expected_arrival"),
  actualDeparture: timestamp("actual_departure"),
  actualArrival: timestamp("actual_arrival"),
  delayMinutes: integer("delay_minutes").default(0),
  status: varchar("status", { enum: ["planned", "active", "completed", "cancelled"] }).default("planned"),
  legs: jsonb("legs"), // Array of journey legs
  createdAt: timestamp("created_at").defaultNow(),
});

export const compensationCases = pgTable("compensation_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  journeyId: varchar("journey_id").references(() => journeys.id).notNull(),
  delayMinutes: integer("delay_minutes").notNull(),
  eligibilityThreshold: integer("eligibility_threshold").notNull(),
  status: varchar("status", { enum: ["detected", "draft", "submitted", "processing", "approved", "rejected"] }).default("detected"),
  estimatedAmount: decimal("estimated_amount", { precision: 10, scale: 2 }),
  actualAmount: decimal("actual_amount", { precision: 10, scale: 2 }),
  // Encrypted personal data
  encryptedPersonalData: text("encrypted_personal_data"), // JSON with name, payment details, etc.
  evidenceIds: text("evidence_ids").array(), // File IDs for uploaded evidence
  slFormUrl: varchar("sl_form_url"), // URL to SL's compensation form with pre-filled data
  submittedAt: timestamp("submitted_at"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const deviations = pgTable("deviations", {
  id: varchar("id").primaryKey(),
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  severity: varchar("severity", { enum: ["info", "warn", "critical"] }).notNull(),
  affectedAreaIds: text("affected_area_ids").array(),
  affectedLineIds: text("affected_line_ids").array(),
  validFrom: timestamp("valid_from"),
  validTo: timestamp("valid_to"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  isActive: boolean("is_active").default(true),
});

// Notification preferences and alerts
export const userNotifications = pgTable("user_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  type: varchar("type", { enum: ["delay", "cancellation", "compensation", "route_change", "maintenance"] }).notNull(),
  severity: varchar("severity", { enum: ["low", "medium", "high", "critical"] }).default("medium"),
  isRead: boolean("is_read").default(false),
  routeId: varchar("route_id").references(() => savedRoutes.id),
  journeyId: varchar("journey_id").references(() => journeys.id),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Service alerts and system notifications
export const serviceAlerts = pgTable("service_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  severity: varchar("severity", { enum: ["info", "warning", "disruption", "maintenance"] }).notNull(),
  affectedLines: text("affected_lines").array(),
  affectedStops: text("affected_stops").array(),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  isActive: boolean("is_active").default(true),
  source: varchar("source").default("SL"),
  externalId: varchar("external_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSavedRouteSchema = createInsertSchema(savedRoutes).omit({
  id: true,
  createdAt: true,
});

export const insertJourneySchema = createInsertSchema(journeys).omit({
  id: true,
  createdAt: true,
});

export const insertCompensationCaseSchema = createInsertSchema(compensationCases).omit({
  id: true,
  createdAt: true,
});

export const insertCommuteRouteSchema = createInsertSchema(commuteRoutes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserNotificationSchema = createInsertSchema(userNotifications).omit({
  id: true,
  createdAt: true,
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
});

export const insertServiceAlertSchema = createInsertSchema(serviceAlerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;
export type SavedRoute = typeof savedRoutes.$inferSelect;
export type InsertSavedRoute = z.infer<typeof insertSavedRouteSchema>;
export type CommuteRoute = typeof commuteRoutes.$inferSelect;
export type InsertCommuteRoute = z.infer<typeof insertCommuteRouteSchema>;
export type Journey = typeof journeys.$inferSelect;
export type InsertJourney = z.infer<typeof insertJourneySchema>;
export type CompensationCase = typeof compensationCases.$inferSelect;
export type InsertCompensationCase = z.infer<typeof insertCompensationCaseSchema>;

export const journeyPlannerSchema = z.object({
  from: z.union([
    z.string().min(1, "Origin is required"),
    z.object({
      id: z.string(),
      name: z.string()
    })
  ]),
  to: z.union([
    z.string().min(1, "Destination is required"),
    z.object({
      id: z.string(),
      name: z.string()
    })
  ]),
  date: z.string(),
  time: z.string(),
  leaveAt: z.boolean().default(true),
});

export const compensationClaimSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  paymentMethod: z.enum(["swish", "bank", "voucher"]),
  paymentDetails: z.string().min(1, "Payment details are required"),
  ticketType: z.string(),
  consent: z.boolean().refine((val) => val === true, "Consent is required"),
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type StopArea = typeof stopAreas.$inferSelect;
export type StopPoint = typeof stopPoints.$inferSelect;
export type Line = typeof lines.$inferSelect;
export type SavedRoute = typeof savedRoutes.$inferSelect;
export type Journey = typeof journeys.$inferSelect;
export type CompensationCase = typeof compensationCases.$inferSelect;
export type Deviation = typeof deviations.$inferSelect;
export type UserNotification = typeof userNotifications.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type ServiceAlert = typeof serviceAlerts.$inferSelect;

export type InsertSavedRoute = z.infer<typeof insertSavedRouteSchema>;
export type InsertJourney = z.infer<typeof insertJourneySchema>;
export type InsertCompensationCase = z.infer<typeof insertCompensationCaseSchema>;
export type InsertUserNotification = z.infer<typeof insertUserNotificationSchema>;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type InsertServiceAlert = z.infer<typeof insertServiceAlertSchema>;
export type JourneyPlannerRequest = z.infer<typeof journeyPlannerSchema>;
export type CompensationClaimRequest = z.infer<typeof compensationClaimSchema>;

// Journey leg types
export type TransitLeg = {
  kind: "TRANSIT";
  line: Line;
  journeyId: string;
  directionCode?: number | string;
  directionText?: string;
  from: { areaId: string; pointId?: string; name: string; platform?: string };
  to: { areaId: string; pointId?: string; name: string; platform?: string };
  plannedDeparture: string;
  plannedArrival: string;
  expectedDeparture?: string;
  expectedArrival?: string;
  cancelled?: boolean;
  platformChange?: boolean;
};

export type WalkLeg = {
  kind: "WALK";
  fromAreaId: string;
  toAreaId: string;
  durationMinutes: number;
  meters?: number;
};

export type Leg = TransitLeg | WalkLeg;

export type Itinerary = {
  id: string;
  legs: Leg[];
  plannedDeparture: string;
  plannedArrival: string;
  expectedDeparture?: string;
  expectedArrival?: string;
  delayMinutes?: number;
};

export type Departure = {
  stopAreaId: string;
  stopPointId?: string;
  line: Line;
  journeyId: string;
  directionText: string;
  plannedTime: string;
  expectedTime?: string;
  state?: "EXPECTED" | "ATSTOP" | "CANCELLED" | "ASSIGNED" | "NORMALPROGRESS";
  platform?: string;
};
