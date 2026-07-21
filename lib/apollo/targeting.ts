/**
 * Apollo contact-targeting rules (Phase 7) — pure functions, no I/O.
 *
 * "Best contact" seniority narrows as the company grows, because outreach to
 * someone who'd never own this decision is wasted:
 *
 *   revenue < $20M          owner/founder/CEO is the buyer — everything allowed
 *   $20M – $500M            C-level OK (CIO/CTO/COO…) but NEVER the CEO
 *   > $500M                 no C-level at all — VP / Head / Director / Manager of IT
 *
 * When revenue is unknown, employee count stands in ($20M ≈ 100 employees,
 * $500M ≈ 1,000 employees — the standard segment cut). When both are unknown
 * we assume mid-tier (no CEO), the safe default.
 */

export const CEO_REVENUE_CEILING = 20_000_000;
export const C_LEVEL_REVENUE_CEILING = 500_000_000;

const CEO_TITLE = /\b(chief executive officer|ceo)\b|owner|founder|\bpresident\b/i;
const C_LEVEL_TITLE = /\bchief\s+\w+(\s+\w+)?\s+officer\b|\bC(EO|IO|TO|OO|FO|MO|DO|SO|ISO|HRO)\b/i;

export type CompanyBand = "small" | "mid" | "large";

/** Which rule band a company falls in, from revenue (primary) or headcount. */
export function companyBand(revenueUsd: number | null, employees: number | null): CompanyBand {
  if (revenueUsd != null) {
    if (revenueUsd < CEO_REVENUE_CEILING) return "small";
    if (revenueUsd <= C_LEVEL_REVENUE_CEILING) return "mid";
    return "large";
  }
  if (employees != null) {
    if (employees < 100) return "small";
    if (employees < 1000) return "mid";
    return "large";
  }
  return "mid";
}

/** Apollo `person_seniorities[]` values to search, per band. */
export function searchSeniorities(band: CompanyBand): string[] {
  if (band === "small") return ["owner", "founder", "c_suite", "vp", "head", "director"];
  if (band === "mid") return ["c_suite", "vp", "head", "director"];
  return ["vp", "head", "director", "manager"];
}

/** IT-first title targeting — the departments that buy wireless/connectivity. */
export const TARGET_TITLES = [
  "CIO",
  "CTO",
  "IT Director",
  "Director of Information Technology",
  "VP of Information Technology",
  "Head of IT",
  "IT Manager",
  "Director of Infrastructure",
  "Network Manager",
  "Telecom Manager",
  "Director of Operations",
];

/**
 * The post-search gate: is this person allowed as a "best contact" for a
 * company of this size? Applied to whatever the search returns, so a fuzzy
 * title match can never smuggle a CEO into a $2B account.
 */
export function isAllowedContact(
  title: string | null,
  revenueUsd: number | null,
  employees: number | null,
): boolean {
  if (!title) return true;
  const band = companyBand(revenueUsd, employees);
  if (band === "small") return true;
  if (CEO_TITLE.test(title)) return false; // ≥ $20M: never the CEO
  if (band === "large" && C_LEVEL_TITLE.test(title)) return false; // > $500M: no C-level
  return true;
}

/**
 * Rank candidates IT-first: IT/network/telecom titles beat generic ops,
 * and within a group higher seniority wins.
 */
export function rankContacts<T extends { title: string | null }>(candidates: T[]): T[] {
  const IT = /\b(information technology|\bIT\b|infrastructure|network|telecom|technolog)/i;
  const SENIORITY =
    /(chief|cio|cto)/i;
  const score = (t: string | null): number => {
    if (!t) return 0;
    let s = 0;
    if (IT.test(t)) s += 10;
    if (SENIORITY.test(t)) s += 3;
    if (/\b(vp|vice president|head)\b/i.test(t)) s += 2;
    if (/\bdirector\b/i.test(t)) s += 1;
    return s;
  };
  return [...candidates].sort((a, b) => score(b.title) - score(a.title));
}
