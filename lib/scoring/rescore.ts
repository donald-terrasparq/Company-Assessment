/**
 * Re-score stored signals with a weight profile — zero API calls (ticket 3.7,
 * reused by the Signals tab's "apply to all lists"). Pure scoring; only the
 * result rows are rewritten.
 */
import {
  listResultsForRun,
  listSignalsForResults,
  updateResultScores,
} from "@/lib/db/queries/results";
import { scoreCompany, type ScorableSignal } from "./score";
import type { Category, WeightProfile } from "./default-weights";

export async function rescoreRun(runId: string, weights: WeightProfile, now: Date): Promise<number> {
  const results = await listResultsForRun(runId);
  const signalRows = await listSignalsForResults(results.map((r) => r.id));
  const byResult = new Map<string, ScorableSignal[]>();
  for (const s of signalRows) {
    const list = byResult.get(s.companyResultId) ?? [];
    list.push({
      event_type: s.eventType,
      categories: s.categories as Category[],
      title: s.title,
      summary: s.summary,
      event_date: s.eventDate,
      is_forward: s.isForward,
      source_url: s.sourceUrl,
      source_name: s.sourceName,
      source_class: (s.sourceClass ?? "weak") as "primary" | "secondary" | "weak",
    });
    byResult.set(s.companyResultId, list);
  }

  let rescored = 0;
  for (const result of results) {
    const scores = scoreCompany(
      {
        fit: {
          industry: result.fitIndustry,
          size: result.fitSize,
          multi_location: result.fitMultilocation,
          geography: result.fitGeography,
        },
        signals: byResult.get(result.id) ?? [],
        caveats: (result.caveats as string[]) ?? [],
      },
      weights,
      now,
    );
    await updateResultScores(result.id, scores);
    rescored++;
  }
  return rescored;
}
