import { eq } from "drizzle-orm";
import { db } from "../client";
import { settings } from "../schema";

export type SettingsRow = typeof settings.$inferSelect;

export async function getSettings(): Promise<SettingsRow | undefined> {
  const rows = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  return rows[0];
}

/** Creates the single settings row (id = 1) with defaults if it doesn't exist. */
export async function ensureSettingsRow(): Promise<{ created: boolean }> {
  const rows = await db
    .insert(settings)
    .values({ id: 1 })
    .onConflictDoNothing({ target: settings.id })
    .returning({ id: settings.id });
  return { created: rows.length > 0 };
}

export async function setAllowOpenRegistration(value: boolean): Promise<void> {
  await db
    .update(settings)
    .set({ allowOpenRegistration: value, updatedAt: new Date() })
    .where(eq(settings.id, 1));
}

/** Admin settings patch (Analysis / Data sources / Budget / Retention tabs). */
export async function updateSettings(patch: {
  model?: string;
  searchProvider?: string;
  monthlyBudgetUsd?: string;
  retentionDays?: number;
  escalationPct?: number;
  apolloEnabled?: boolean;
}): Promise<void> {
  await db
    .update(settings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(settings.id, 1));
}
