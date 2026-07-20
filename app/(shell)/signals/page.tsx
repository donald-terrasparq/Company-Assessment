import { auth } from "@/auth";
import { listListsWithLatestRun } from "@/lib/db/queries/lists";
import { getDefaultProfile } from "@/lib/db/queries/profiles";
import { listResultsForRun, listSignalsForResults } from "@/lib/db/queries/results";
import { DEFAULT_WEIGHTS, type WeightProfile } from "@/lib/scoring/default-weights";
import { SignalsEditor, type PreviewCompany } from "@/components/signals/signals-editor";

export default async function SignalsPage() {
  const [session, profile, lists] = await Promise.all([
    auth(),
    getDefaultProfile(),
    listListsWithLatestRun(),
  ]);
  const isAdmin = session?.user.role === "admin";
  const weights = (profile?.weights as WeightProfile) ?? DEFAULT_WEIGHTS;

  // preview dataset: every latest-run result with its stored signals
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
          categories: s.categories as PreviewCompany["signals"][number]["categories"],
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

  return <SignalsEditor initialWeights={weights} companies={companies} isAdmin={isAdmin} />;
}
