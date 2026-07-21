/**
 * Apollo organization enrichment + news (approved additions #1 and #2).
 * Runs during the worker's enrichment stage, gated on settings.apollo_enabled.
 *
 * - Organization Enrichment fills the firmographics gap (employees, revenue,
 *   retail locations, funding, tech stack) — no export credits.
 * - News articles become citable reference sources for the extraction pass;
 *   items without a resolvable URL are dropped (hard rule 3).
 */
import { apolloGet, apolloPost } from "./client";
import type { SearchHit } from "@/lib/search/provider";

export interface ApolloOrgData {
  orgId: string | null;
  employees: number | null;
  revenueUsd: number | null;
  locationCount: number | null;
  facts: string[]; // reference lines for the extraction prompt
}

interface OrgEnrichResponse {
  organization?: {
    id?: string;
    name?: string;
    estimated_num_employees?: number | null;
    annual_revenue?: number | null;
    retail_location_count?: number | null;
    industry?: string | null;
    founded_year?: number | null;
    publicly_traded_symbol?: string | null;
    total_funding_printed?: string | null;
    latest_funding_stage?: string | null;
    latest_funding_round_date?: string | null;
    technology_names?: string[] | null;
  };
}

/** Map Apollo's org payload to the numbers + prompt facts we use. Pure. */
export function mapOrganization(data: OrgEnrichResponse): ApolloOrgData {
  const org = data.organization;
  if (!org) return { orgId: null, employees: null, revenueUsd: null, locationCount: null, facts: [] };

  const employees = org.estimated_num_employees ?? null;
  const revenueUsd = org.annual_revenue ?? null;
  const locationCount = org.retail_location_count ?? null;

  const facts: string[] = [];
  const bits: string[] = [];
  if (employees) bits.push(`~${employees.toLocaleString()} employees`);
  if (revenueUsd) bits.push(`~$${Math.round(revenueUsd / 1e6).toLocaleString()}M annual revenue`);
  if (locationCount) bits.push(`${locationCount} retail locations`);
  if (org.founded_year) bits.push(`founded ${org.founded_year}`);
  if (org.publicly_traded_symbol) bits.push(`public (${org.publicly_traded_symbol})`);
  if (bits.length > 0) facts.push(`Apollo directory: ${bits.join(", ")}.`);
  if (org.latest_funding_stage) {
    facts.push(
      `Apollo funding: latest round ${org.latest_funding_stage}${org.latest_funding_round_date ? ` (${org.latest_funding_round_date.slice(0, 10)})` : ""}${org.total_funding_printed ? `, total raised ${org.total_funding_printed}` : ""}.`,
    );
  }
  const tech = (org.technology_names ?? []).slice(0, 12);
  if (tech.length > 0) facts.push(`Apollo detected tech in use: ${tech.join(", ")}.`);

  return { orgId: org.id ?? null, employees, revenueUsd, locationCount, facts };
}

export async function enrichOrganization(domain: string): Promise<ApolloOrgData> {
  const data = await apolloGet<OrgEnrichResponse>("/organizations/enrich", { domain });
  return mapOrganization(data);
}

interface NewsResponse {
  news_articles?: Array<{
    title?: string | null;
    url?: string | null;
    published_at?: string | null;
    event?: string | null; // e.g. "expansion", "acquisition", "hires"
    snippet?: string | null;
  }>;
}

const MAX_NEWS = 8;

/** Map Apollo news to citable SearchHits — no URL, no item (hard rule 3). Pure. */
export function mapNews(data: NewsResponse): SearchHit[] {
  return (data.news_articles ?? [])
    .filter((a): a is { title: string; url: string; published_at?: string | null; event?: string | null; snippet?: string | null } =>
      !!a.url && !!a.title && /^https?:\/\//.test(a.url),
    )
    .slice(0, MAX_NEWS)
    .map((a) => ({
      url: a.url,
      title: a.title,
      snippet: (a.snippet ?? (a.event ? `News event: ${a.event}` : "")).slice(0, 300),
      publishedDate: a.published_at ? a.published_at.slice(0, 10) : null,
      source: "apollo_news",
    }));
}

/** Recent event articles for the company (last 12 months). */
export async function newsForOrganization(orgId: string, now: Date): Promise<SearchHit[]> {
  const since = new Date(now.getTime() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const data = await apolloPost<NewsResponse>("/news_articles/search", {
    organization_ids: [orgId],
    published_at_min: since,
    per_page: 25,
    page: 1,
  });
  return mapNews(data);
}
