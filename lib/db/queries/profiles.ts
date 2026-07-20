import { eq } from "drizzle-orm";
import { db } from "../client";
import { signalProfiles } from "../schema";

export type SignalProfileRow = typeof signalProfiles.$inferSelect;

export async function getDefaultProfile(): Promise<SignalProfileRow | undefined> {
  const rows = await db
    .select()
    .from(signalProfiles)
    .where(eq(signalProfiles.isDefault, true))
    .limit(1);
  return rows[0];
}

export async function createDefaultProfile(weights: unknown): Promise<SignalProfileRow> {
  const rows = await db
    .insert(signalProfiles)
    .values({ name: "Default", isDefault: true, weights })
    .returning();
  return rows[0];
}

/** Overwrite the default profile's weights (Signals tab → Save). */
export async function updateDefaultProfile(name: string, weights: unknown): Promise<void> {
  await db
    .update(signalProfiles)
    .set({ name, weights })
    .where(eq(signalProfiles.isDefault, true));
}
