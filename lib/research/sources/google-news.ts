/**
 * Google News RSS — free, no key, unofficial (can be fragile; failures are
 * silently tolerated). Recent headlines per company.
 */
import { fetchText } from "./util";
import type { SearchHit } from "@/lib/search/provider";

const strip = (s: string) =>
  s
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

/** Pure: parse Google News RSS XML into SearchHits (regex — no XML dep). */
export function parseGoogleNewsRss(xml: string, limit = 8): SearchHit[] {
  const hits: SearchHit[] = [];
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  for (const item of items) {
    if (hits.length >= limit) break;
    const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1];
    const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];
    const source = item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1];
    if (!title || !link) continue;
    let publishedDate: string | null = null;
    if (pubDate) {
      const t = new Date(strip(pubDate));
      if (!Number.isNaN(t.getTime())) publishedDate = t.toISOString().slice(0, 10);
    }
    hits.push({
      url: strip(link),
      title: strip(title),
      snippet: `Headline via ${source ? strip(source) : "Google News"}`,
      publishedDate,
      source: "google_news",
    });
  }
  return hits;
}

export async function googleNewsHeadlines(companyName: string): Promise<SearchHit[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`"${companyName}"`)}&hl=en-US&gl=US&ceid=US:en`;
  const xml = await fetchText(url);
  return xml ? parseGoogleNewsRss(xml) : [];
}
