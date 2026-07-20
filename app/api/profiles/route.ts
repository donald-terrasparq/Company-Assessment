import { auth } from "@/auth";
import { listListsWithLatestRun } from "@/lib/db/queries/lists";
import { updateDefaultProfile } from "@/lib/db/queries/profiles";
import { parseWeightProfile } from "@/lib/scoring/weights-schema";
import { rescoreRun } from "@/lib/scoring/rescore";

/**
 * POST /api/profiles — save the default weight profile (admin only).
 * Body: { name, weights, apply } — apply=true re-scores the latest run of
 * every list from stored signals (zero API calls).
 */
export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return Response.json({ error: "Admins only." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    weights?: unknown;
    apply?: boolean;
  } | null;
  if (!body?.weights) {
    return Response.json({ error: "weights required." }, { status: 400 });
  }

  const parsed = parseWeightProfile(body.weights);
  if (!parsed.ok) {
    return Response.json({ error: `Invalid weights — ${parsed.message}` }, { status: 422 });
  }
  const fitSum =
    parsed.weights.fit.industry +
    parsed.weights.fit.size +
    parsed.weights.fit.multi_location +
    parsed.weights.fit.geography;
  if (fitSum !== 30) {
    return Response.json(
      { error: `Fit weights must total 30 (currently ${fitSum}).` },
      { status: 422 },
    );
  }

  const name = (body.name ?? "Default").trim().slice(0, 60) || "Default";
  await updateDefaultProfile(name, parsed.weights);

  let rescored = 0;
  let runsTouched = 0;
  if (body.apply) {
    const now = new Date();
    const lists = await listListsWithLatestRun();
    for (const list of lists) {
      if (!list.latestRunId) continue;
      rescored += await rescoreRun(list.latestRunId, parsed.weights, now);
      runsTouched++;
    }
  }

  return Response.json({ ok: true, applied: !!body.apply, runsTouched, rescored });
}
