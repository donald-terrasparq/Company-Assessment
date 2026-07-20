/**
 * USAspending.gov — free, no key. Federal contract awards to the company:
 * public-sector buying signals and a size/credibility indicator.
 */
import { fetchJson } from "./util";
import type { SearchHit } from "@/lib/search/provider";

interface AwardRow {
  "Award ID"?: string;
  "Recipient Name"?: string;
  "Award Amount"?: number;
  "Start Date"?: string;
  generated_internal_id?: string;
}

export async function federalAwards(
  companyName: string,
  now: Date,
): Promise<{ facts: string[]; hits: SearchHit[] }> {
  const start = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const body = await fetchJson<{ results?: AwardRow[] }>(
    "https://api.usaspending.gov/api/v2/search/spending_by_award/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filters: {
          recipient_search_text: [companyName],
          award_type_codes: ["A", "B", "C", "D"],
          time_period: [{ start_date: start, end_date: now.toISOString().slice(0, 10) }],
        },
        fields: ["Award ID", "Recipient Name", "Award Amount", "Start Date"],
        order: "desc",
        sort: "Award Amount",
        limit: 3,
      }),
    },
  );
  const results = (body?.results ?? []).filter(
    (r) => r["Recipient Name"] && typeof r["Award Amount"] === "number",
  );
  if (results.length === 0) return { facts: [], hits: [] };

  const total = results.reduce((sum, r) => sum + (r["Award Amount"] ?? 0), 0);
  const facts = [
    `Federal contractor (USAspending, last 2y): ${results.length}+ contract award(s), top awards ≈ $${Math.round(total).toLocaleString()}.`,
  ];
  const hits: SearchHit[] = results
    .filter((r) => r.generated_internal_id)
    .map((r) => ({
      url: `https://www.usaspending.gov/award/${r.generated_internal_id}`,
      title: `Federal contract award to ${r["Recipient Name"]} — $${Math.round(r["Award Amount"] ?? 0).toLocaleString()}`,
      snippet: `USAspending.gov award record, start ${r["Start Date"] ?? "n/a"}.`,
      publishedDate: r["Start Date"] ?? null,
      source: "usaspending",
    }));
  return { facts, hits };
}
