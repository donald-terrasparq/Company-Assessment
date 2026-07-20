/**
 * Greenhouse / Lever public job-board feeds — free, no key. Live posting
 * counts are a precise hiring-surge signal instead of an inference. Board
 * slugs aren't discoverable, so we try likely candidates; 404s are cheap.
 */
import { fetchJson } from "./util";
import type { SearchHit } from "@/lib/search/provider";

/** Pure: likely board-slug candidates from the company name + domain. */
export function slugCandidates(companyName: string, domain: string | null): string[] {
  const out = new Set<string>();
  const compact = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (compact) out.add(compact);
  const wordy = companyName
    .toLowerCase()
    .replace(/\b(inc|corp|corporation|co|company|ltd|llc|group|holdings?)\b/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "");
  if (wordy) out.add(wordy);
  if (domain) {
    const label = domain.split(".")[0];
    if (label) out.add(label.replace(/[^a-z0-9]/g, ""));
  }
  return [...out].filter((s) => s.length >= 3).slice(0, 3);
}

interface GreenhouseResponse {
  jobs?: Array<{ title?: string; absolute_url?: string; location?: { name?: string } }>;
}

export async function jobBoardSignals(
  companyName: string,
  domain: string | null,
): Promise<{ facts: string[]; hits: SearchHit[] }> {
  for (const slug of slugCandidates(companyName, domain)) {
    const gh = await fetchJson<GreenhouseResponse>(
      `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`,
    );
    if (gh?.jobs && gh.jobs.length > 0) {
      const sample = gh.jobs
        .slice(0, 5)
        .map((j) => j.title)
        .filter(Boolean)
        .join("; ");
      return {
        facts: [
          `Live job board (Greenhouse): ${gh.jobs.length} open positions. Sample: ${sample}`,
        ],
        hits: [
          {
            url: `https://boards.greenhouse.io/${slug}`,
            title: `${companyName} careers — ${gh.jobs.length} open positions (Greenhouse)`,
            snippet: `Live job board listing ${gh.jobs.length} open roles. Sample: ${sample}`,
            publishedDate: null,
            source: "greenhouse",
          },
        ],
      };
    }

    const lever = await fetchJson<
      Array<{ text?: string; hostedUrl?: string; categories?: { location?: string } }>
    >(`https://api.lever.co/v0/postings/${slug}?mode=json`);
    if (Array.isArray(lever) && lever.length > 0) {
      const sample = lever
        .slice(0, 5)
        .map((j) => j.text)
        .filter(Boolean)
        .join("; ");
      return {
        facts: [`Live job board (Lever): ${lever.length} open positions. Sample: ${sample}`],
        hits: [
          {
            url: `https://jobs.lever.co/${slug}`,
            title: `${companyName} careers — ${lever.length} open positions (Lever)`,
            snippet: `Live job board listing ${lever.length} open roles. Sample: ${sample}`,
            publishedDate: null,
            source: "lever",
          },
        ],
      };
    }
  }
  return { facts: [], hits: [] };
}
