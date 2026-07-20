/**
 * Free enrichment layer: registry facts + extra news/jobs/contracts sources
 * gathered per company alongside web search. Every connector is independent,
 * time-bounded, and failure-tolerant — a dead endpoint costs one source, not
 * the run. All are $0 (no api_usage rows).
 */
import { normalizeDomain } from "@/lib/normalize/domain";
import type { SearchHit } from "@/lib/search/provider";
import { edgarFacts } from "./sources/edgar-facts";
import { gdeltNews } from "./sources/gdelt";
import { googleNewsHeadlines } from "./sources/google-news";
import { jobBoardSignals } from "./sources/job-boards";
import { usaspendingEnabled } from "./sources/flags";
import { federalAwards } from "./sources/usaspending";
import { wikidataFacts } from "./sources/wikidata";

export interface Enrichment {
  facts: string[]; // reference lines for the extraction prompt
  hits: SearchHit[]; // extra citable sources (news, job boards, awards)
  officialDomain: string | null; // Wikidata's official site, normalized
}

const MAX_ENRICHMENT_HITS = 10;

export async function enrichCompany(
  companyName: string,
  domain: string | null,
  now: Date,
): Promise<Enrichment> {
  const [wikidata, edgar, gdelt, news, jobs, awards] = await Promise.allSettled([
    wikidataFacts(companyName),
    edgarFacts(companyName),
    gdeltNews(companyName),
    googleNewsHeadlines(companyName),
    jobBoardSignals(companyName, domain),
    usaspendingEnabled() ? federalAwards(companyName, now) : Promise.resolve({ facts: [], hits: [] }),
  ]);

  const value = <T>(r: PromiseSettledResult<T>, fallback: T): T =>
    r.status === "fulfilled" ? r.value : fallback;

  const wd = value(wikidata, { facts: [], officialWebsite: null });
  const jb = value(jobs, { facts: [], hits: [] });
  const aw = value(awards, { facts: [], hits: [] });

  const facts = [...wd.facts, ...value(edgar, []), ...jb.facts, ...aw.facts];

  // dedupe extra hits by URL, cap so they augment rather than crowd out search
  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  for (const hit of [...value(gdelt, []), ...value(news, []), ...jb.hits, ...aw.hits]) {
    if (seen.has(hit.url)) continue;
    seen.add(hit.url);
    hits.push(hit);
    if (hits.length >= MAX_ENRICHMENT_HITS) break;
  }

  return { facts, hits, officialDomain: normalizeDomain(wd.officialWebsite) };
}
