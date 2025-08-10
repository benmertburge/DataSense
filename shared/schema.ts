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

export const journeyPlannerSchema = z.object({
  from: z.string().min(1, "Origin is required"),
  to: z.string().min(1, "Destination is required"),
  via: z.string().optional(),
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

export type InsertSavedRoute = z.infer<typeof insertSavedRouteSchema>;
export type InsertJourney = z.infer<typeof insertJourneySchema>;
export type InsertCompensationCase = z.infer<typeof insertCompensationCaseSchema>;
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
