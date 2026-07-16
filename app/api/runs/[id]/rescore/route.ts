import { auth } from "@/auth";
import { getDefaultProfile } from "@/lib/db/queries/profiles";
import {
  listResultsForRun,
  listSignalsForResults,
  updateResultScores,
} from "@/lib/db/queries/results";
import { findRunById } from "@/lib/db/queries/runs";
import { scoreCompany, type ScorableSignal } from "@/lib/scoring/score";
import type { Category, WeightProfile } from "@/lib/scoring/default-weights";

/**
 * POST /api/runs/:id/rescore — re-run the pure scorer over STORED signals with
 * the current default weight profile. Zero API calls, zero cost (ticket 3.7).
 * This is why signals are always kept: they're the expensive part.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
  const { id } = await params;
  const run = await findRunById(id);
  if (!run) return Response.json({ error: "Run not found." }, { status: 404 });

  const profile = await getDefaultProfile();
  if (!profile) {
    return Response.json({ error: "No default signal profile." }, { status: 500 });
  }
  const weights = profile.weights as WeightProfile;

  const results = await listResultsForRun(id);
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

  const now = new Date();
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

  return Response.json({ ok: true, rescored });
}
