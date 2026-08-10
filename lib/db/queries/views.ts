import { sql } from "drizzle-orm";
import { db } from "../client";
import { companyViews } from "../schema";

/**
 * Record that a user opened a company's detail page. Idempotent upsert:
 * first view inserts, later views only bump last_viewed_at.
 */
export async function recordCompanyView(userId: string, companyId: string): Promise<void> {
  await db
    .insert(companyViews)
    .values({ userId, companyId })
    .onConflictDoUpdate({
      target: [companyViews.userId, companyViews.companyId],
      set: { lastViewedAt: sql`now()` },
    });
}
