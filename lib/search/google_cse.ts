import type { SearchHit, SearchProvider } from "./provider";

/** Google Programmable Search Engine — 100 queries/day free, then $5/1,000. */
export const googleCseProvider: SearchProvider = {
  name: "google_cse",
  costPerSearchUsd: 0.005,

  async search(query, opts): Promise<SearchHit[]> {
    const key = process.env.GOOGLE_CSE_KEY;
    const cx = process.env.GOOGLE_CSE_ID;
    if (!key || !cx) throw new Error("GOOGLE_CSE_KEY / GOOGLE_CSE_ID are not set");
    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", key);
    url.searchParams.set("cx", cx);
    url.searchParams.set("q", query);
    url.searchParams.set("num", String(Math.min(opts?.limit ?? 5, 10)));
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`google_cse search failed: ${res.status}`);
    const body = (await res.json()) as {
      items?: Array<{ link: string; title: string; snippet?: string }>;
    };
    return (body.items ?? []).map((r) => ({
      url: r.link,
      title: r.title,
      snippet: r.snippet ?? "",
      publishedDate: null,
      source: "google_cse",
    }));
  },
};
