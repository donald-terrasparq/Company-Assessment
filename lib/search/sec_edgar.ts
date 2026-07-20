import type { SearchHit, SearchProvider } from "./provider";

/**
 * SEC EDGAR full-text search — free, official, no key. Always on alongside the
 * configured provider (docs/01-ARCHITECTURE.md). SEC requires a descriptive
 * User-Agent (SEC_USER_AGENT).
 */
export const secEdgarProvider: SearchProvider = {
  name: "sec_edgar",
  costPerSearchUsd: 0,

  async search(query, opts): Promise<SearchHit[]> {
    const url = new URL("https://efts.sec.gov/LATEST/search-index");
    url.searchParams.set("q", `"${query}"`);
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          process.env.SEC_USER_AGENT ?? "Company Assessment research (contact: ops@example.com)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`sec_edgar search failed: ${res.status}`);
    const body = (await res.json()) as {
      hits?: {
        hits?: Array<{
          _id: string; // "0001234567-26-000123:document.htm"
          _source?: {
            ciks?: string[];
            display_names?: string[];
            file_date?: string;
            root_forms?: string[];
            form?: string;
          };
        }>;
      };
    };
    const hits = body.hits?.hits ?? [];
    const out: SearchHit[] = [];
    for (const h of hits.slice(0, opts?.limit ?? 5)) {
      const [accession, file] = h._id.split(":");
      const src = h._source ?? {};
      const cik = src.ciks?.[0];
      if (!accession || !file || !cik) continue; // no reconstructable URL → skip (rule 3)
      const form = src.form ?? src.root_forms?.[0] ?? "Filing";
      out.push({
        url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replace(/-/g, "")}/${file}`,
        title: `SEC ${form} — ${(src.display_names ?? []).join(", ") || query}`,
        snippet: `SEC ${form} filing dated ${src.file_date ?? "unknown"}`,
        publishedDate: src.file_date ?? null,
        source: "sec_edgar",
      });
    }
    return out;
  },
};
