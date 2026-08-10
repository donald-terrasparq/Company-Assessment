import { z } from "zod";
import { auth } from "@/auth";
import { apolloErrorMessage, isApolloConfigured } from "@/lib/apollo/client";
import { enrichOrganizationFull, newsForOrganization } from "@/lib/apollo/organization";
import { findCompanyById } from "@/lib/db/queries/lists";
import { upsertCompanyEnrichment } from "@/lib/db/queries/enrichment";
import { getSettings } from "@/lib/db/queries/settings";
import { logUsage } from "@/lib/db/queries/usage";

const BodySchema = z.object({ company_id: z.string().uuid() });

/**
 * POST /api/apollo/enrich-company — (re-)pull the Apollo company snapshot for
 * the Company enrichment card: LinkedIn page, description, firmographics,
 * funding, detected tech, and recent news. Runs automatically during analysis
 * (worker stage 1c); this route is the on-demand refresh for companies that
 * were analyzed earlier. No export credits are consumed.
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
  if (!parsed.success) return Response.json({ error: "company_id (uuid) required." }, { status: 400 });

  const company = await findCompanyById(parsed.data.company_id);
  if (!company) return Response.json({ error: "Company not found." }, { status: 404 });
  if (!company.domain) {
    return Response.json({ error: "No domain on file — Apollo needs one to enrich." }, { status: 422 });
  }

  try {
    const full = await enrichOrganizationFull(company.domain);
    if (!full.details) {
      return Response.json(
        { error: "Apollo has no directory entry for this domain." },
        { status: 404 },
      );
    }
    const news = full.summary.orgId
      ? await newsForOrganization(full.summary.orgId, new Date()).catch(() => [])
      : [];

    await upsertCompanyEnrichment(company.id, {
      ...full.details,
      news: news.map((n) => ({
        title: n.title,
        url: n.url,
        date: n.publishedDate ?? null,
        event: null,
      })),
    });

    await logUsage({
      runId: null,
      companyId: company.id,
      provider: "apollo",
      searches: 1 + (news.length > 0 ? 1 : 0),
      costUsd: 0, // org enrichment + news consume no export credits
    });

    return Response.json({ ok: true, news_count: news.length });
  } catch (err) {
    console.error("apollo enrich-company:", err);
    return Response.json({ error: apolloErrorMessage(err) }, { status: 502 });
  }
}
