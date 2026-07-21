import { desc, eq } from "drizzle-orm";
import { db } from "../client";
import { companyProfiles } from "../schema";
import { CTS_PROFILE, parseCompanyProfile, type CompanyProfile } from "@/lib/company/profile";

export type CompanyProfileRow = typeof companyProfiles.$inferSelect;

function toProfile(row: CompanyProfileRow): CompanyProfile {
  return parseCompanyProfile({
    id: row.id,
    name: row.name,
    website: row.website,
    industry: row.industry,
    products: row.products,
    aiContext: row.aiContext,
  });
}

/** The seller identity everything runs as — CTS fallback pre-migration. */
export async function getActiveCompanyProfile(): Promise<CompanyProfile> {
  try {
    const rows = await db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.isActive, true))
      .limit(1);
    return rows[0] ? toProfile(rows[0]) : CTS_PROFILE;
  } catch {
    return CTS_PROFILE; // table missing (pre-0009 DB) — behave exactly as before
  }
}

export async function listProfiles(): Promise<Array<CompanyProfile & { isActive: boolean }>> {
  const rows = await db.select().from(companyProfiles).orderBy(desc(companyProfiles.isActive), companyProfiles.createdAt);
  return rows.map((r) => ({ ...toProfile(r), isActive: r.isActive }));
}

export async function findProfileById(id: string): Promise<CompanyProfile | null> {
  const rows = await db.select().from(companyProfiles).where(eq(companyProfiles.id, id)).limit(1);
  return rows[0] ? toProfile(rows[0]) : null;
}

export async function createProfile(profile: CompanyProfile): Promise<string> {
  const [row] = await db
    .insert(companyProfiles)
    .values({
      name: profile.name,
      website: profile.website,
      industry: profile.industry,
      products: profile.products,
      aiContext: profile.aiContext,
      isActive: false,
    })
    .returning({ id: companyProfiles.id });
  return row.id;
}

export async function updateProfile(id: string, profile: CompanyProfile): Promise<void> {
  await db
    .update(companyProfiles)
    .set({
      name: profile.name,
      website: profile.website,
      industry: profile.industry,
      products: profile.products,
      aiContext: profile.aiContext,
    })
    .where(eq(companyProfiles.id, id));
}

/** Exactly one active profile — deactivate the rest in the same transaction. */
export async function setActiveProfile(id: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(companyProfiles).set({ isActive: false }).where(eq(companyProfiles.isActive, true));
    await tx.update(companyProfiles).set({ isActive: true }).where(eq(companyProfiles.id, id));
  });
}

/** No active profile → the app falls back to the built-in CTS defaults. */
export async function deactivateProfile(id: string): Promise<void> {
  await db.update(companyProfiles).set({ isActive: false }).where(eq(companyProfiles.id, id));
}

export async function deleteProfile(id: string): Promise<void> {
  await db.delete(companyProfiles).where(eq(companyProfiles.id, id));
}
