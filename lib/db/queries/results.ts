import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../client";
import { companyResults, contacts, signals } from "../schema";
import type { Scores } from "@/lib/scoring/score";

export type CompanyResultRow = typeof companyResults.$inferSelect;
export type SignalRow = typeof signals.$inferSelect;

export interface ResultContact {
  name: string;
  title: string | null;
  roleRationale: string | null;
  linkedinUrl: string | null;
}

export interface ResultMeta {
  industry: string | null;
  hq: string | null;
  sizeLabel: string | null;
  employeeEstimate: number | null;
  locationCount: number | null;
  whyNow: string | null;
  recommendedPlay: string | null; // newline-separated steps
  caveats: string[];
  coverageNotes: Array<{ tone: "good" | "warn"; note: string }>;
}

/**
 * Idempotent write of one company's result (hard rule 8): the UNIQUE
 * (run_id, company_id) makes retries an upsert; signals and contacts are
 * replaced wholesale so a retried job can't double-insert evidence.
 */
export async function upsertCompanyResult(input: {
  runId: string;
  companyId: string;
  scores: Scores;
  meta: ResultMeta;
  contacts: ResultContact[];
}): Promise<string> {
  const { scores, meta } = input;
  return db.transaction(async (tx) => {
    const values = {
      runId: input.runId,
      companyId: input.companyId,
      fitScore: scores.fit_score,
      triggerScore: scores.trigger_score,
      totalScore: scores.total_score,
      tier: scores.tier,
      fwaScore: scores.fwa_score,
      starlinkScore: scores.starlink_score,
      mobilityScore: scores.mobility_score,
      byodScore: scores.byod_score,
      primaryCategory: scores.primary_category,
      fitIndustry: scores.fit_industry,
      fitSize: scores.fit_size,
      fitMultilocation: scores.fit_multilocation,
      fitGeography: scores.fit_geography,
      industry: meta.industry,
      hq: meta.hq,
      sizeLabel: meta.sizeLabel,
      employeeEstimate: meta.employeeEstimate,
      locationCount: meta.locationCount,
      whyNow: meta.whyNow,
      recommendedPlay: meta.recommendedPlay,
      caveats: meta.caveats,
      coverageNotes: meta.coverageNotes,
      recencyLabel: scores.recency_label,
      confidence: scores.confidence === null ? null : scores.confidence.toFixed(2),
    };
    const [row] = await tx
      .insert(companyResults)
      .values(values)
      .onConflictDoUpdate({
        target: [companyResults.runId, companyResults.companyId],
        set: values,
      })
      .returning({ id: companyResults.id });

    await tx.delete(signals).where(eq(signals.companyResultId, row.id));
    if (scores.signals.length > 0) {
      await tx.insert(signals).values(
        scores.signals.map((s) => ({
          companyResultId: row.id,
          eventType: s.event_type,
          categories: s.categories,
          title: s.title,
          summary: s.summary,
          eventDate: s.event_date,
          isForward: s.is_forward,
          recencyMultiplier: s.recency_multiplier.toFixed(2),
          confidence: s.confidence.toFixed(2),
          basePoints: s.base_points,
          pointsAwarded: s.points_awarded.toFixed(2),
          sourceUrl: s.source_url,
          sourceName: s.source_name,
          sourceClass: s.source_class,
        })),
      );
    }

    await tx.delete(contacts).where(eq(contacts.companyResultId, row.id));
    if (input.contacts.length > 0) {
      await tx.insert(contacts).values(
        input.contacts.map((c) => ({
          companyResultId: row.id,
          name: c.name,
          title: c.title,
          roleRationale: c.roleRationale,
          linkedinUrl: c.linkedinUrl,
          source: "search" as const,
          verified: false, // rule 3: unverified until a licensed source confirms
        })),
      );
    }
    return row.id;
  });
}

export async function listResultsForRun(runId: string): Promise<CompanyResultRow[]> {
  return db.select().from(companyResults).where(eq(companyResults.runId, runId));
}

export async function listSignalsForResults(resultIds: string[]): Promise<SignalRow[]> {
  if (resultIds.length === 0) return [];
  return db.select().from(signals).where(inArray(signals.companyResultId, resultIds));
}

/** Rewrite scores for one result from re-scored signals (rescore path). */
export async function updateResultScores(resultId: string, scores: Scores): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(companyResults)
      .set({
        fitScore: scores.fit_score,
        triggerScore: scores.trigger_score,
        totalScore: scores.total_score,
        tier: scores.tier,
        fwaScore: scores.fwa_score,
        starlinkScore: scores.starlink_score,
        mobilityScore: scores.mobility_score,
        byodScore: scores.byod_score,
        primaryCategory: scores.primary_category,
        recencyLabel: scores.recency_label,
      })
      .where(eq(companyResults.id, resultId));
    for (const s of scores.signals) {
      await tx.execute(sql`
        UPDATE signals SET
          recency_multiplier = ${s.recency_multiplier.toFixed(2)},
          confidence = ${s.confidence.toFixed(2)},
          base_points = ${s.base_points},
          points_awarded = ${s.points_awarded.toFixed(2)}
        WHERE company_result_id = ${resultId} AND source_url = ${s.source_url}
          AND event_type = ${s.event_type}
      `);
    }
  });
}
