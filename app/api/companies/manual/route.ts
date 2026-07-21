import { z } from "zod";
import { auth } from "@/auth";
import { normalizeDomain } from "@/lib/normalize/domain";
import {
  createRunWithSingleJob,
  findOrAddManualCompany,
  getOrCreateManualList,
} from "@/lib/db/queries/manual";
import { getDefaultProfile } from "@/lib/db/queries/profiles";
import { getSettings } from "@/lib/db/queries/settings";
import { monthToDateCostUsd } from "@/lib/db/queries/usage";

const BodySchema = z.object({
  name: z.string().trim().min(2).max(200),
  website: z.string().trim().max(300).nullable().optional(),
});

/**
 * POST /api/companies/manual — the Add-company button. Files the company into
 * the shared "Manual Entry" list and enqueues a SINGLE-job run (hard rule 7:
 * the worker does the analysis; this returns immediately). Budget cap applies
 * like any run; the hourly run rate limit doesn't — one company is cheap.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Not signed in." }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Company name (2+ characters) is required." }, { status: 400 });
  }

  const settings = await getSettings();
  if (!settings) {
    return Response.json({ error: "Settings not seeded — run db:seed." }, { status: 500 });
  }
  if ((await monthToDateCostUsd()) >= Number(settings.monthlyBudgetUsd)) {
    return Response.json(
      { error: `Monthly budget cap ($${settings.monthlyBudgetUsd}) reached.` },
      { status: 402 },
    );
  }
  const profile = await getDefaultProfile();
  if (!profile) {
    return Response.json({ error: "No default signal profile — run db:seed." }, { status: 500 });
  }

  try {
    const list = await getOrCreateManualList(session.user.id);
    const domain = normalizeDomain(parsed.data.website ?? null);
    const { companyId } = await findOrAddManualCompany({
      listId: list.id,
      name: parsed.data.name,
      website: parsed.data.website ?? null,
      domain,
    });
    const run = await createRunWithSingleJob({
      listId: list.id,
      companyId,
      signalProfileId: profile.id,
      model: settings.model,
      searchProvider: settings.searchProvider,
      triggeredBy: session.user.id,
    });
    return Response.json(
      { run_id: run.id, company_id: companyId, list_id: list.id },
      { status: 202 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start the search.";
    return Response.json({ error: message }, { status: 422 });
  }
}
