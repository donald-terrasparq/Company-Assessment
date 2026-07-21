import { listListsWithLatestRun } from "./lists";
import { listResultsForRun, listSignalsForResults } from "./results";
import type { ScorableSignal } from "@/lib/scoring/score";

/** One stored result with its signals, ready for client-side re-scoring. */
export interface PreviewCompany {
  resultId: string;
  tier: string;
  totalScore: number;
  fit: { industry: number; size: number; multi_location: number; geography: number };
  caveats: string[];
  signals: ScorableSignal[];
}

/** Every latest-run result with its stored signals — the live-preview dataset. */
export async function loadPreviewCompanies(): Promise<PreviewCompany[]> {
  const lists = await listListsWithLatestRun();
  const companies: PreviewCompany[] = [];
  for (const list of lists) {
    if (!list.latestRunId) continue;
    const results = await listResultsForRun(list.latestRunId);
    const signals = await listSignalsForResults(results.map((r) => r.id));
    const byResult = new Map<string, typeof signals>();
    for (const s of signals) {
      const arr = byResult.get(s.companyResultId) ?? [];
      arr.push(s);
      byResult.set(s.companyResultId, arr);
    }
    for (const r of results) {
      companies.push({
        resultId: r.id,
        tier: r.tier,
        totalScore: r.totalScore,
        fit: {
          industry: r.fitIndustry,
          size: r.fitSize,
          multi_location: r.fitMultilocation,
          geography: r.fitGeography,
        },
        caveats: (r.caveats as string[]) ?? [],
        signals: (byResult.get(r.id) ?? []).map((s) => ({
          event_type: s.eventType,
          categories: s.categories as ScorableSignal["categories"],
          title: s.title,
          summary: s.summary,
          event_date: s.eventDate,
          is_forward: s.isForward,
          source_url: s.sourceUrl,
          source_name: s.sourceName,
          source_class: (s.sourceClass ?? "weak") as "primary" | "secondary" | "weak",
        })),
      });
    }
  }
  return companies;
}
