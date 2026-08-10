import { asc, eq } from "drizzle-orm";
import { db } from "../client";
import { manualContacts } from "../schema";

export type ManualContactRow = typeof manualContacts.$inferSelect;

export async function listManualContactsForCompany(
  companyId: string,
): Promise<ManualContactRow[]> {
  return db
    .select()
    .from(manualContacts)
    .where(eq(manualContacts.companyId, companyId))
    .orderBy(asc(manualContacts.createdAt));
}

export async function getManualContact(id: string): Promise<ManualContactRow | null> {
  const rows = await db.select().from(manualContacts).where(eq(manualContacts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function addManualContact(input: {
  companyId: string;
  firstName: string;
  lastName: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  overridesName: string | null;
  createdBy: string | null;
}): Promise<ManualContactRow> {
  const rows = await db.insert(manualContacts).values(input).returning();
  return rows[0];
}

export async function updateManualContact(
  id: string,
  fields: {
    firstName?: string;
    lastName?: string | null;
    title?: string | null;
    email?: string | null;
    phone?: string | null;
  },
): Promise<void> {
  await db
    .update(manualContacts)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(manualContacts.id, id));
}

export async function deleteManualContact(id: string): Promise<void> {
  await db.delete(manualContacts).where(eq(manualContacts.id, id));
}

/** A correction row for an auto-found contact, matched by original name. */
export async function findOverrideByName(
  companyId: string,
  name: string,
): Promise<ManualContactRow | null> {
  const rows = await db
    .select()
    .from(manualContacts)
    .where(eq(manualContacts.companyId, companyId));
  const lower = name.trim().toLowerCase();
  return rows.find((r) => r.overridesName?.trim().toLowerCase() === lower) ?? null;
}
