import { z } from "zod";
import { auth } from "@/auth";
import { apolloErrorMessage, isApolloConfigured } from "@/lib/apollo/client";
import { searchBestContacts } from "@/lib/apollo/contacts";
import { parseContactPrefs } from "@/lib/apollo/prefs";
import { addApolloContacts, countApolloContacts, replaceApolloContacts } from "@/lib/db/queries/contacts";
import { getResultDetail } from "@/lib/db/queries/prospects";
import { getSettings } from "@/lib/db/queries/settings";
import { logUsage } from "@/lib/db/queries/usage";

const BodySchema = z.object({
  result_id: z.string().uuid(),
  // quick-filter overrides from the Top Contacts card; defaults come from
  // Settings → Contacts. Unknown values are dropped by parseContactPrefs.
  overrides: z
    .object({
      seniorities: z.array(z.string()).max(10).optional(),
      departments: z.array(z.string()).max(10).optional(),
      titles: z.array(z.string().max(60)).max(12).optional(),
    })
    .nullable()
    .optional(),
  // true = append the NEXT page of ranked matches (offset = contacts already shown)
  load_more: z.boolean().optional().default(false),
});

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

  const defaults = parseContactPrefs(settings.contactDefaults);
  const prefs = parsed.data.overrides
    ? parseContactPrefs({ ...defaults, ...parsed.data.overrides })
    : defaults;

  try {
    // load-more appends the next window of the ranked matches; the offset is
    // however many Apollo contacts this result already shows
    const offset = parsed.data.load_more ? await countApolloContacts(detail.result.id) : 0;
    const { candidates, totalMatching } = await searchBestContacts({
      domain: detail.company.domain,
      revenueUsd: detail.result.annualRevenueUsd,
      employees: detail.result.employeeEstimate,
      prefs,
      offset,
    });
    // filter changes REPLACE what's on the card (keeping enriched and
    // research-found contacts); load-more and the default search only add
    const added =
      parsed.data.overrides && !parsed.data.load_more
        ? await replaceApolloContacts(detail.result.id, candidates)
        : await addApolloContacts(detail.result.id, candidates);
    await logUsage({
      runId: detail.result.runId,
      companyId: detail.company.id,
      provider: "apollo",
      searches: 1,
      costUsd: 0, // people search consumes no export credits
    });
    return Response.json({
      found: totalMatching,
      added,
      has_more: offset + candidates.length < totalMatching,
    });
  } catch (err) {
    console.error("apollo contacts:", err);
    return Response.json({ error: apolloErrorMessage(err) }, { status: 502 });
  }
}
