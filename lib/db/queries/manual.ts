/**
 * Manual Entry (single-company searches from the Add-company button).
 * All typed-in companies collect in one shared "Manual Entry" list; each
 * search runs as its own single-job run, so re-searching one company never
 * re-analyzes the rest of the list.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../client";
import { companies, jobs, lists, runs } from "../schema";
import type { RunRow } from "./runs";

export const MANUAL_LIST_NAME = "Manual Entry";
const LIST_CAP = 100;

export async function getOrCreateManualList(userId: string) {
  const existing = await db
    .select()
    .from(lists)
    .where(and(eq(lists.name, MANUAL_LIST_NAME), isNull(lists.deletedAt)))
    .limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db
    .insert(lists)
    .values({
      name: MANUAL_LIST_NAME,
      displayName: MANUAL_LIST_NAME,
      uploadedBy: userId,
      sourceFilename: "manual-entry",
      companyCount: 0,
    })
    .returning();
  return created;
}

/**
 * Find or add the typed-in company (matched by domain, else by name,
 * case-insensitive). Re-searching an existing entry reuses its row so the
 * list never collects duplicates. Throws on the 100-company cap.
 */
export async function findOrAddManualCompany(input: {
  listId: string;
  name: string;
  website: string | null;
  domain: string | null;
}): Promise<{ companyId: string; created: boolean }> {
  const rows = await db.select().from(companies).where(eq(companies.listId, input.listId));
  const match = rows.find((c) =>
    input.domain ? c.domain === input.domain : c.name.trim().toLowerCase() === input.name.trim().toLowerCase(),
  );
  if (match) return { companyId: match.id, created: false };

  if (rows.length >= LIST_CAP) {
    throw new Error(
      `The Manual Entry list is at its ${LIST_CAP}-company cap — delete it from Lists to start fresh.`,
    );
  }
  const [created] = await db
    .insert(companies)
    .values({
      listId: input.listId,
      name: input.name.trim(),
      website: input.website,
      domain: input.domain,
      domainSource: input.domain ? "upload" : null,
      rawRow: { manual: true },
    })
    .returning({ id: companies.id });
  await db
    .update(lists)
    .set({ companyCount: sql`${lists.companyCount} + 1` })
    .where(eq(lists.id, input.listId));
  return { companyId: created.id, created: true };
}

/** One run, one job — the single-company analysis behind a manual search. */
export async function createRunWithSingleJob(input: {
  listId: string;
  companyId: string;
  signalProfileId: string;
  model: string;
  searchProvider: string;
  triggeredBy: string;
}): Promise<RunRow> {
  return db.transaction(async (tx) => {
    const [run] = await tx
      .insert(runs)
      .values({
        listId: input.listId,
        signalProfileId: input.signalProfileId,
        model: input.model,
        searchProvider: input.searchProvider,
        triggeredBy: input.triggeredBy,
      })
      .returning();
    await tx.insert(jobs).values({ runId: run.id, companyId: input.companyId });
    return run;
  });
}
