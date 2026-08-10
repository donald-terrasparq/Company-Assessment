import { eq } from "drizzle-orm";
import { db } from "../client";
import { companies } from "../schema";

export const MAX_CONTACT_HINTS = 5;

/** Durable per-company contact search hints (0015). Survive re-analysis. */
export async function setCompanyContactHints(
  companyId: string,
  hints: { nameHints: string[]; titleHints: string[] },
): Promise<void> {
  await db
    .update(companies)
    .set({
      contactNameHints: hints.nameHints.slice(0, MAX_CONTACT_HINTS),
      contactTitleHints: hints.titleHints.slice(0, MAX_CONTACT_HINTS),
    })
    .where(eq(companies.id, companyId));
}

export async function getCompanyContactHints(
  companyId: string,
): Promise<{ nameHints: string[]; titleHints: string[] }> {
  const rows = await db
    .select({
      nameHints: companies.contactNameHints,
      titleHints: companies.contactTitleHints,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  return rows[0] ?? { nameHints: [], titleHints: [] };
}
