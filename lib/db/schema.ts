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
