import { auth } from "@/auth";
import { getDefaultProfile } from "@/lib/db/queries/profiles";
import { findRunById } from "@/lib/db/queries/runs";
import { rescoreRun } from "@/lib/scoring/rescore";
import type { WeightProfile } from "@/lib/scoring/default-weights";

/**
 * POST /api/runs/:id/rescore — re-run the pure scorer over STORED signals with
 * the current default weight profile. Zero API calls, zero cost (ticket 3.7).
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
  const rescored = await rescoreRun(id, profile.weights as WeightProfile, new Date());
  return Response.json({ ok: true, rescored });
}
