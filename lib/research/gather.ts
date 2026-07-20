/**
 * Build the query set for one company, run the searches, dedupe by URL,
 * return ≤ 20 hits (ticket 3.2, queries from docs/06-PROMPTS.md). Hits older
 * than 18 months are dropped — they cost tokens and score ~0.1 anyway.
 */
import { secEdgarProvider } from "@/lib/search/sec_edgar";
import type { SearchHit, SearchProvider } from "@/lib/search/provider";

export const MAX_HITS = 20;
/** Settings-tunable 4–12 in a later ticket; constant for now. */
export const SEARCHES_PER_COMPANY = 10;
const MAX_HIT_AGE_DAYS = 548; // ~18 months

export function buildQuerySet(companyName: string, year: number): string[] {
  const n = companyName;
  return [
    `"${n}" new facility OR headquarters OR expansion ${year}`,
    `"${n}" new store OR branch OR location opening ${year}`,
    // footprint queries — how many sites the company actually has. Without
    // these, chains read as single-site (the Micro Center failure mode).
    `"${n}" number of stores OR locations OR branches`,
    `"${n}" "locations" about company overview`,
    `"${n}" hiring OR jobs OR "new employees" ${year}`,
    `"${n}" acquisition OR merger OR funding ${year}`,
    `"${n}" CIO OR CTO OR "VP of IT" OR "head of infrastructure"`,
    `"${n}" outage OR downtime OR "business continuity"`,
    `"${n}" remote work OR BYOD OR field technicians OR warehouse`,
    `site:sec.gov "${n}"`,
  ].slice(0, SEARCHES_PER_COMPANY);
}

export interface GatherOutcome {
  hits: SearchHit[];
  searches: number;
  searchCostUsd: number;
  secSearches: number;
}

export async function gather(input: {
  companyName: string;
  provider: SearchProvider;
  now: Date;
}): Promise<GatherOutcome> {
  const queries = buildQuerySet(input.companyName, input.now.getUTCFullYear());
  const all: SearchHit[] = [];
  let searches = 0;
  let secSearches = 0;

  for (const q of queries) {
    try {
      all.push(...(await input.provider.search(q, { limit: 5 })));
      searches++;
    } catch {
      // one failed query shouldn't sink the company; proceed with what we have
    }
  }

  // always and free: SEC EDGAR full-text search on the entity name
  try {
    all.push(...(await secEdgarProvider.search(input.companyName, { limit: 5 })));
    secSearches = 1;
  } catch {
    // EDGAR hiccups are non-fatal
  }

  const cutoff = input.now.getTime() - MAX_HIT_AGE_DAYS * 24 * 60 * 60 * 1000;
  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  for (const hit of all) {
    if (seen.has(hit.url)) continue;
    seen.add(hit.url);
    if (hit.publishedDate) {
      const t = new Date(`${hit.publishedDate}T00:00:00Z`).getTime();
      if (Number.isFinite(t) && t < cutoff) continue;
    }
    hits.push(hit);
    if (hits.length >= MAX_HITS) break;
  }

  return {
    hits,
    searches,
    secSearches,
    searchCostUsd: searches * input.provider.costPerSearchUsd,
  };
}
