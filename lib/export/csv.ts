/** Pure CSV builder for the prospects export (ticket 4.5). */
import type { ProspectRow } from "@/lib/db/queries/prospects";

function esc(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const CSV_HEADERS = [
  "rank",
  "company",
  "domain",
  "industry",
  "hq",
  "size",
  "tier",
  "total_score",
  "fit_score",
  "trigger_score",
  "fwa_score",
  "starlink_score",
  "mobility_score",
  "byod_score",
  "primary_category",
  "why_now",
  "caveats",
  "list",
] as const;

export function prospectsToCsv(rows: ProspectRow[]): string {
  const lines = [CSV_HEADERS.join(",")];
  rows.forEach((r, i) => {
    lines.push(
      [
        i + 1,
        esc(r.companyName),
        esc(r.domain),
        esc(r.industry),
        esc(r.hq),
        esc(r.sizeLabel),
        esc(r.tier),
        r.totalScore,
        r.fitScore,
        r.triggerScore,
        r.fwaScore,
        r.starlinkScore,
        r.mobilityScore,
        r.byodScore,
        esc(r.primaryCategory),
        esc(r.whyNow),
        esc(r.caveats.join("; ")),
        esc(r.listName),
      ].join(","),
    );
  });
  return lines.join("\r\n") + "\r\n";
}

export interface ProspectFilters {
  tiers: string[]; // empty = all
  categories: string[]; // matches primaryCategory; empty = all
  freshOnly: boolean;
  hideCaveats: boolean;
}

/** The same filter logic the table uses — export must honor active filters. */
export function applyFilters(rows: ProspectRow[], f: ProspectFilters): ProspectRow[] {
  return rows.filter((r) => {
    if (f.tiers.length > 0 && !f.tiers.includes(r.tier)) return false;
    if (
      f.categories.length > 0 &&
      (!r.primaryCategory || !f.categories.includes(r.primaryCategory))
    ) {
      return false;
    }
    if (f.freshOnly && !(r.recencyLabel === "<30d" || r.recencyLabel === "forward")) {
      return false;
    }
    if (f.hideCaveats && r.caveats.length > 0) return false;
    return true;
  });
}
