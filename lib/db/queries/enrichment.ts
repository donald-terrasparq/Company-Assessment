import { eq } from "drizzle-orm";
import { db } from "../client";
import { companyEnrichment } from "../schema";

export type CompanyEnrichmentRow = typeof companyEnrichment.$inferSelect;

export interface EnrichmentNewsItem {
  title: string;
  url: string;
  date: string | null;
  event: string | null;
}

export interface CompanyEnrichmentInput {
  linkedinUrl: string | null;
  description: string | null;
  industry: string | null;
  foundedYear: number | null;
  employees: number | null;
  annualRevenueUsd: number | null;
  locationCount: number | null;
  publiclyTradedSymbol: string | null;
  totalFunding: string | null;
  latestFundingStage: string | null;
  latestFundingDate: string | null;
  keywords: string[];
  news: EnrichmentNewsItem[];
}

/** One snapshot per company — re-enrichment replaces it wholesale. */
export async function upsertCompanyEnrichment(
  companyId: string,
  input: CompanyEnrichmentInput,
): Promise<void> {
  await db
    .insert(companyEnrichment)
    .values({ companyId, ...input, enrichedAt: new Date() })
    .onConflictDoUpdate({
      target: companyEnrichment.companyId,
      set: { ...input, enrichedAt: new Date() },
    });
}

export async function getCompanyEnrichment(
  companyId: string,
): Promise<CompanyEnrichmentRow | null> {
  try {
    const rows = await db
      .select()
      .from(companyEnrichment)
      .where(eq(companyEnrichment.companyId, companyId))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null; // table missing (pre-0016 DB)
  }
}
