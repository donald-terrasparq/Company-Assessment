import { desc, eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "../client";
import { companies, companyResults, contacts, lists, runs, signals } from "../schema";
import type { CompanyResultRow, SignalRow } from "./results";

export interface ProspectRow {
  resultId: string;
  companyId: string;
  companyName: string;
  website: string | null;
  domain: string | null;
  domainSource: "upload" | "lookup" | null;
  listId: string;
  listName: string;
  industry: string | null;
  hq: string | null;
  sizeLabel: string | null;
  fitScore: number;
  triggerScore: number;
  totalScore: number;
  tier: string;
  fwaScore: number;
  starlinkScore: number;
  mobilityScore: number;
  byodScore: number;
  primaryCategory: string | null;
  whyNow: string | null;
  recencyLabel: string | null;
  caveats: string[];
}

function mapRow(r: Record<string, unknown>): ProspectRow {
  return {
    resultId: r.result_id as string,
    companyId: r.company_id as string,
    companyName: r.company_name as string,
    website: (r.website as string) ?? null,
    domain: (r.domain as string) ?? null,
    domainSource: (r.domain_source as "upload" | "lookup") ?? null,
    listId: r.list_id as string,
    listName: r.list_name as string,
    industry: (r.industry as string) ?? null,
    hq: (r.hq as string) ?? null,
    sizeLabel: (r.size_label as string) ?? null,
    fitScore: Number(r.fit_score),
    triggerScore: Number(r.trigger_score),
    totalScore: Number(r.total_score),
    tier: r.tier as string,
    fwaScore: Number(r.fwa_score),
    starlinkScore: Number(r.starlink_score),
    mobilityScore: Number(r.mobility_score),
    byodScore: Number(r.byod_score),
    primaryCategory: (r.primary_category as string) ?? null,
    whyNow: (r.why_now as string) ?? null,
    recencyLabel: (r.recency_label as string) ?? null,
    caveats: (r.caveats as string[]) ?? [],
  };
}

/** Results of the latest run of one list (any status — rows stream in mid-run). */
export async function prospectsForList(listId: string): Promise<ProspectRow[]> {
  const result = await db.execute(sql`
    SELECT cr.id AS result_id, cr.company_id, c.name AS company_name, c.website,
           c.domain, c.domain_source, l.id AS list_id, l.display_name AS list_name,
           cr.industry, cr.hq, cr.size_label, cr.fit_score, cr.trigger_score,
           cr.total_score, cr.tier, cr.fwa_score, cr.starlink_score,
           cr.mobility_score, cr.byod_score, cr.primary_category, cr.why_now,
           cr.recency_label, cr.caveats
    FROM company_results cr
    JOIN (SELECT id FROM runs WHERE list_id = ${listId} AND deleted_at IS NULL
          ORDER BY created_at DESC LIMIT 1) latest
      ON latest.id = cr.run_id
    JOIN companies c ON c.id = cr.company_id
    JOIN lists l ON l.id = c.list_id
    ORDER BY cr.total_score DESC, cr.created_at
  `);
  return (result.rows as Record<string, unknown>[]).map(mapRow);
}

/** VIEW ALL — the `all_prospects` view: latest complete run of every list, deduped by domain. */
export async function allProspects(): Promise<ProspectRow[]> {
  const result = await db.execute(sql`
    SELECT ap.id AS result_id, ap.company_id, ap.company_name, ap.website, ap.domain,
           c.domain_source, ap.list_id, ap.list_name, ap.industry, ap.hq,
           ap.size_label, ap.fit_score, ap.trigger_score, ap.total_score, ap.tier,
           ap.fwa_score, ap.starlink_score, ap.mobility_score, ap.byod_score,
           ap.primary_category, ap.why_now, ap.recency_label, ap.caveats
    FROM all_prospects ap
    JOIN companies c ON c.id = ap.company_id
    ORDER BY ap.total_score DESC
  `);
  return (result.rows as Record<string, unknown>[]).map(mapRow);
}

export interface ResultDetail {
  result: CompanyResultRow;
  company: typeof companies.$inferSelect;
  list: typeof lists.$inferSelect;
  run: typeof runs.$inferSelect;
  signals: SignalRow[];
  contacts: Array<typeof contacts.$inferSelect>;
}

export async function getResultDetail(resultId: string): Promise<ResultDetail | null> {
  const resultRows = await db
    .select()
    .from(companyResults)
    .where(eq(companyResults.id, resultId))
    .limit(1);
  const result = resultRows[0];
  if (!result) return null;

  const [companyRows, runRows, signalRows, contactRows] = await Promise.all([
    db.select().from(companies).where(eq(companies.id, result.companyId)).limit(1),
    db.select().from(runs).where(eq(runs.id, result.runId)).limit(1),
    db
      .select()
      .from(signals)
      .where(eq(signals.companyResultId, resultId))
      .orderBy(desc(signals.eventDate)),
    db.select().from(contacts).where(eq(contacts.companyResultId, resultId)),
  ]);
  const company = companyRows[0];
  const run = runRows[0];
  if (!company || !run) return null;
  const listRows = await db
    .select()
    .from(lists)
    .where(inArray(lists.id, [company.listId]))
    .limit(1);
  if (!listRows[0]) return null;

  return {
    result,
    company,
    list: listRows[0],
    run,
    signals: signalRows,
    contacts: contactRows,
  };
}
