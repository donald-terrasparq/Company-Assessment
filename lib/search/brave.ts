import type { SearchHit, SearchProvider } from "./provider";

/** Brave Search API — free tier ~2,000 queries/mo. Phase 1 default provider. */
export const braveProvider: SearchProvider = {
  name: "brave",
  costPerSearchUsd: 0, // free tier; revisit if upgraded to a paid plan

  async search(query, opts): Promise<SearchHit[]> {
    const key = process.env.BRAVE_API_KEY;
    if (!key) throw new Error("BRAVE_API_KEY is not set");
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(opts?.limit ?? 5));
    const res = await fetch(url, {
      headers: { "X-Subscription-Token": key, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`brave search failed: ${res.status}`);
    const body = (await res.json()) as {
      web?: { results?: Array<{ url: string; title: string; description?: string; page_age?: string }> };
    };
    return (body.web?.results ?? []).map((r) => ({
      url: r.url,
      title: r.title,
      snippet: r.description ?? "",
      publishedDate: r.page_age ? r.page_age.slice(0, 10) : null,
      source: "brave",
    }));
  },
};
