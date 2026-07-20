/**
 * Drizzle table definitions. The SQL in db/schema.sql is the source of truth —
 * these must mirror it. Tables are added here as the phases that need them
 * land (Phase 1: users, invites, settings, signal_profiles).
 */
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  jsonb,
  date,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  createdBy: uuid("created_by"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedBy: uuid("used_by"),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  model: text("model").notNull().default("claude-sonnet-5"),
  highAccuracyModel: text("high_accuracy_model").notNull().default("claude-opus-4-8"),
  searchProvider: text("search_provider").notNull().default("brave"),
  monthlyBudgetUsd: numeric("monthly_budget_usd", { precision: 10, scale: 2 })
    .notNull()
    .default("100.00"),
  allowOpenRegistration: boolean("allow_open_registration").notNull().default(false),
  retentionDays: integer("retention_days").notNull().default(365),
  apolloEnabled: boolean("apollo_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const signalProfiles = pgTable("signal_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  weights: jsonb("weights").notNull(),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lists = pgTable("lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  uploadedBy: uuid("uploaded_by"),
  sourceFilename: text("source_filename"),
  blobUrl: text("blob_url"),
  companyCount: integer("company_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  listId: uuid("list_id").notNull(),
  name: text("name").notNull(),
  website: text("website"),
  domain: text("domain"),
  domainSource: text("domain_source", { enum: ["upload", "lookup"] }),
  rawRow: jsonb("raw_row").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  listId: uuid("list_id").notNull(),
  signalProfileId: uuid("signal_profile_id").notNull(),
  status: text("status", {
    enum: ["queued", "running", "complete", "failed", "halted_budget"],
  })
    .notNull()
    .default("queued"),
  model: text("model").notNull(),
  searchProvider: text("search_provider").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  triggeredBy: uuid("triggered_by"),
  costUsd: numeric("cost_usd", { precision: 10, scale: 4 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull(),
  companyId: uuid("company_id").notNull(),
  status: text("status", { enum: ["pending", "claimed", "done", "failed"] })
    .notNull()
    .default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const companyResults = pgTable("company_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull(),
  companyId: uuid("company_id").notNull(),
  fitScore: integer("fit_score").notNull(),
  triggerScore: integer("trigger_score").notNull(),
  totalScore: integer("total_score").notNull(),
  tier: text("tier", { enum: ["tier_1", "tier_2", "tier_3", "defunct"] }).notNull(),
  fwaScore: integer("fwa_score").notNull().default(0),
  starlinkScore: integer("starlink_score").notNull().default(0),
  mobilityScore: integer("mobility_score").notNull().default(0),
  byodScore: integer("byod_score").notNull().default(0),
  primaryCategory: text("primary_category", {
    enum: ["FWA", "STARLINK", "MOBILITY", "BYOD"],
  }),
  fitIndustry: integer("fit_industry").notNull().default(0),
  fitSize: integer("fit_size").notNull().default(0),
  fitMultilocation: integer("fit_multilocation").notNull().default(0),
  fitGeography: integer("fit_geography").notNull().default(0),
  industry: text("industry"),
  hq: text("hq"),
  sizeLabel: text("size_label"),
  employeeEstimate: integer("employee_estimate"),
  locationCount: integer("location_count"),
  whyNow: text("why_now"),
  recommendedPlay: text("recommended_play"),
  caveats: jsonb("caveats").notNull().default([]),
  coverageNotes: jsonb("coverage_notes").notNull().default([]),
  recencyLabel: text("recency_label"),
  confidence: numeric("confidence", { precision: 3, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const signals = pgTable("signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyResultId: uuid("company_result_id").notNull(),
  eventType: text("event_type").notNull(),
  categories: text("categories").array().notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  eventDate: date("event_date"),
  isForward: boolean("is_forward").notNull().default(false),
  recencyMultiplier: numeric("recency_multiplier", { precision: 3, scale: 2 }).notNull(),
  confidence: numeric("confidence", { precision: 3, scale: 2 }).notNull(),
  basePoints: integer("base_points").notNull(),
  pointsAwarded: numeric("points_awarded", { precision: 6, scale: 2 }).notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceName: text("source_name"),
  sourceClass: text("source_class", { enum: ["primary", "secondary", "weak"] }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyResultId: uuid("company_result_id").notNull(),
  name: text("name").notNull(),
  title: text("title"),
  roleRationale: text("role_rationale"),
  linkedinUrl: text("linkedin_url"),
  email: text("email"),
  phone: text("phone"),
  source: text("source", { enum: ["search", "apollo", "manual"] })
    .notNull()
    .default("search"),
  verified: boolean("verified").notNull().default(false),
  enrichedAt: timestamp("enriched_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiUsage = pgTable("api_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id"),
  companyId: uuid("company_id"),
  provider: text("provider").notNull(),
  searches: integer("searches").notNull().default(0),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costUsd: numeric("cost_usd", { precision: 10, scale: 6 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
