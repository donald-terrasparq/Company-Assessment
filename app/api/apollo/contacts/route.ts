import { z } from "zod";
import { auth } from "@/auth";
import { apolloErrorMessage, isApolloConfigured } from "@/lib/apollo/client";
import { searchBestContacts } from "@/lib/apollo/contacts";
import { addApolloContacts } from "@/lib/db/queries/contacts";
import { getResultDetail } from "@/lib/db/queries/prospects";
import { getSettings } from "@/lib/db/queries/settings";
import { logUsage } from "@/lib/db/queries/usage";

const BodySchema = z.object({ result_id: z.string().uuid() });

/**
 * POST /api/apollo/contacts — find target best contacts for one company.
 * Search only: names/titles/LinkedIn, no emails, no export credits. The
 * seniority gate (no CEO ≥ $20M revenue, no C-level > $500M) is applied
 * server-side in lib/apollo before anything is stored.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Not signed in." }, { status: 401 });

  const settings = await getSettings();
  if (!settings?.apolloEnabled) {
    return Response.json({ error: "Apollo is disabled in Settings → Data sources." }, { status: 403 });
  }
  if (!isApolloConfigured()) {
    return Response.json({ error: "Apollo key is not configured — set the APOLLO env var in Render." }, { status: 503 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "result_id (uuid) required." }, { status: 400 });

  const detail = await getResultDetail(parsed.data.result_id);
  if (!detail) return Response.json({ error: "Result not found." }, { status: 404 });
  if (!detail.company.domain) {
    return Response.json({ error: "No domain on file — Apollo needs one to search." }, { status: 422 });
  }

  try {
    const candidates = await searchBestContacts({
      domain: detail.company.domain,
      revenueUsd: detail.result.annualRevenueUsd,
      employees: detail.result.employeeEstimate,
    });
    const added = await addApolloContacts(detail.result.id, candidates);
    await logUsage({
      runId: detail.result.runId,
      companyId: detail.company.id,
      provider: "apollo",
      searches: 1,
      costUsd: 0, // people search consumes no export credits
    });
    return Response.json({ found: candidates.length, added });
  } catch (err) {
    console.error("apollo contacts:", err);
    return Response.json({ error: apolloErrorMessage(err) }, { status: 502 });
  }
}
