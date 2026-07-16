import { z } from "zod";
import { auth } from "@/auth";
import { findListById } from "@/lib/db/queries/lists";
import { getDefaultProfile } from "@/lib/db/queries/profiles";
import { countRecentRunsByUser, createRunWithJobs } from "@/lib/db/queries/runs";
import { getSettings } from "@/lib/db/queries/settings";
import { monthToDateCostUsd } from "@/lib/db/queries/usage";

const BodySchema = z.object({ list_id: z.string().uuid() });
const MAX_RUNS_PER_HOUR = 3;

/**
 * POST /api/runs — enqueue and return 202 immediately (hard rule 7). The
 * Render worker drains the queue; no HTTP handler ever loops over companies.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "list_id (uuid) is required." }, { status: 400 });
  }

  const list = await findListById(parsed.data.list_id);
  if (!list) return Response.json({ error: "List not found." }, { status: 404 });

  // server-side rate limit: 3 runs per user per hour
  if ((await countRecentRunsByUser(session.user.id)) >= MAX_RUNS_PER_HOUR) {
    return Response.json(
      { error: "Rate limit: 3 runs per hour per user. Try again later." },
      { status: 429 },
    );
  }

  // budget cap (hard rule 6): don't even enqueue when over
  const settings = await getSettings();
  if (!settings) {
    return Response.json({ error: "Settings not seeded — run db:seed." }, { status: 500 });
  }
  const spent = await monthToDateCostUsd();
  if (spent >= Number(settings.monthlyBudgetUsd)) {
    return Response.json(
      { error: `Monthly budget cap ($${settings.monthlyBudgetUsd}) reached.` },
      { status: 402 },
    );
  }

  const profile = await getDefaultProfile();
  if (!profile) {
    return Response.json({ error: "No default signal profile — run db:seed." }, { status: 500 });
  }

  const run = await createRunWithJobs({
    listId: list.id,
    signalProfileId: profile.id,
    model: settings.model,
    searchProvider: settings.searchProvider,
    triggeredBy: session.user.id,
  });

  return Response.json({ run_id: run.id }, { status: 202 });
}
