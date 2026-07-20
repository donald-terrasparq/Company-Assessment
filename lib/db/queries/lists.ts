import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../client";
import { companies, lists, runs } from "../schema";

export type ListRow = typeof lists.$inferSelect;
export type CompanyRow = typeof companies.$inferSelect;

export async function createListWithCompanies(input: {
  name: string;
  displayName: string;
  uploadedBy: string;
  sourceFilename: string;
  blobUrl: string | null;
  rows: Array<{
    name: string;
    website: string | null;
    domain: string | null;
    rawRow: Record<string, unknown>;
  }>;
}): Promise<ListRow> {
  return db.transaction(async (tx) => {
    const [list] = await tx
      .insert(lists)
      .values({
        name: input.name,
        displayName: input.displayName,
        uploadedBy: input.uploadedBy,
        sourceFilename: input.sourceFilename,
        blobUrl: input.blobUrl,
        companyCount: input.rows.length,
      })
      .returning();
    if (input.rows.length > 0) {
      await tx.insert(companies).values(
        input.rows.map((r) => ({
          listId: list.id,
          name: r.name,
          website: r.website,
          domain: r.domain,
          domainSource: r.domain ? ("upload" as const) : null,
          rawRow: r.rawRow,
        })),
      );
    }
    return list;
  });
}

export interface ListWithLatestRun extends ListRow {
  latestRunId: string | null;
  latestRunStatus: string | null;
  latestRunCostUsd: string | null;
  latestRunCreatedAt: Date | null;
}

export async function listListsWithLatestRun(): Promise<ListWithLatestRun[]> {
  const rows = await db.execute(sql`
    SELECT l.*,
           r.id         AS latest_run_id,
           r.status     AS latest_run_status,
           r.cost_usd   AS latest_run_cost_usd,
           r.created_at AS latest_run_created_at
    FROM lists l
    LEFT JOIN LATERAL (
      SELECT * FROM runs WHERE runs.list_id = l.id ORDER BY created_at DESC LIMIT 1
    ) r ON TRUE
    WHERE l.deleted_at IS NULL
    ORDER BY l.created_at DESC
  `);
  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    displayName: r.display_name as string,
    uploadedBy: r.uploaded_by as string | null,
    sourceFilename: r.source_filename as string | null,
    blobUrl: r.blob_url as string | null,
    companyCount: Number(r.company_count),
    createdAt: new Date(r.created_at as string),
    deletedAt: r.deleted_at ? new Date(r.deleted_at as string) : null,
    latestRunId: (r.latest_run_id as string) ?? null,
    latestRunStatus: (r.latest_run_status as string) ?? null,
    latestRunCostUsd: (r.latest_run_cost_usd as string) ?? null,
    latestRunCreatedAt: r.latest_run_created_at
      ? new Date(r.latest_run_created_at as string)
      : null,
  }));
}

export async function findListById(id: string): Promise<ListRow | undefined> {
  const rows = await db
    .select()
    .from(lists)
    .where(and(eq(lists.id, id), isNull(lists.deletedAt)))
    .limit(1);
  return rows[0];
}

export async function softDeleteList(id: string): Promise<void> {
  await db.update(lists).set({ deletedAt: new Date() }).where(eq(lists.id, id));
}

export async function listCompaniesForList(listId: string): Promise<CompanyRow[]> {
  return db
    .select()
    .from(companies)
    .where(eq(companies.listId, listId))
    .orderBy(companies.createdAt);
}

export async function findCompanyById(id: string): Promise<CompanyRow | undefined> {
  const rows = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return rows[0];
}

export async function setCompanyDomain(
  id: string,
  domain: string,
  source: "upload" | "lookup",
): Promise<void> {
  await db
    .update(companies)
    .set({ domain, domainSource: source })
    .where(eq(companies.id, id));
}

export async function latestRunForList(listId: string) {
  const rows = await db
    .select()
    .from(runs)
    .where(eq(runs.listId, listId))
    .orderBy(desc(runs.createdAt))
    .limit(1);
  return rows[0];
}
