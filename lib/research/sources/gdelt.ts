/**
 * GDELT DOC 2.0 — free global news firehose, no key. Catches local-press
 * coverage that general web search misses.
 */
import { fetchJson } from "./util";
import type { SearchHit } from "@/lib/search/provider";

interface GdeltResponse {
  articles?: Array<{
    url?: string;
    title?: string;
    seendate?: string; // "20260716T120000Z"
    domain?: string;
  }>;
}

/** Pure: map GDELT articles to SearchHits. */
export function mapGdeltArticles(articles: NonNullable<GdeltResponse["articles"]>): SearchHit[] {
  const out: SearchHit[] = [];
  for (const a of articles) {
    if (!a.url || !a.title) continue;
    const d = a.seendate?.match(/^(\d{4})(\d{2})(\d{2})/);
    out.push({
      url: a.url,
      title: a.title,
      snippet: `News coverage via ${a.domain ?? "GDELT"}`,
      publishedDate: d ? `${d[1]}-${d[2]}-${d[3]}` : null,
      source: "gdelt",
    });
  }
  return out;
}

export async function gdeltNews(companyName: string): Promise<SearchHit[]> {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", `"${companyName}"`);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("maxrecords", "8");
  url.searchParams.set("format", "json");
  url.searchParams.set("timespan", "12months");
  url.searchParams.set("sort", "datedesc");
  const body = await fetchJson<GdeltResponse>(url.toString());
  return mapGdeltArticles(body?.articles ?? []);
}
