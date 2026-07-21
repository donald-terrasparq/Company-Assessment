/**
 * B2B market-segment classification — the generally accepted (Gartner-style)
 * cut used across B2B sales:
 *
 *   SMB          < 100 employees   or  < $50M annual revenue
 *   Mid-Market   100–999 employees or  $50M–$1B annual revenue
 *   Enterprise   1,000+ employees  or  $1B+ annual revenue
 *
 * Employee count is the primary yardstick (public, stable); revenue can only
 * promote a company upward — a 300-person firm doing $2B is Enterprise, but
 * a 5,000-person firm is never demoted by low reported revenue.
 */

export type Segment = "enterprise" | "mid_market" | "smb";

export interface SegmentMeta {
  key: Segment;
  label: string;
  short: string; // fits the square indicator
  hint: string; // tooltip: the defining thresholds
  color: string; // solid indicator background
  soft: string; // soft chip background
  text: string; // text color on the soft chip
}

export const SEGMENT_META: Record<Segment, SegmentMeta> = {
  enterprise: {
    key: "enterprise",
    label: "Enterprise",
    short: "ENT",
    hint: "Enterprise — 1,000+ employees or $1B+ annual revenue",
    color: "#5B4FD8",
    soft: "#EDEBFB",
    text: "#4A3FC4",
  },
  mid_market: {
    key: "mid_market",
    label: "Mid-Market",
    short: "MM",
    hint: "Mid-Market — 100–999 employees or $50M–$1B annual revenue",
    color: "#1F7AC8",
    soft: "#E5F1FA",
    text: "#186AA5",
  },
  smb: {
    key: "smb",
    label: "SMB",
    short: "SMB",
    hint: "SMB — under 100 employees and under $50M annual revenue",
    color: "#0E9F76",
    soft: "#E2F5EE",
    text: "#0C8563",
  },
};

const ENTERPRISE_EMPLOYEES = 1000;
const MID_MARKET_EMPLOYEES = 100;
const ENTERPRISE_REVENUE = 1_000_000_000;
const MID_MARKET_REVENUE = 50_000_000;

/**
 * Fallback when no numeric estimate was extracted: pull the largest number
 * out of a size label like "1,000+ employees" or "201–500 employees".
 */
export function employeesFromLabel(sizeLabel: string | null): number | null {
  if (!sizeLabel) return null;
  const matches = sizeLabel.replaceAll(",", "").match(/\d+/g);
  if (!matches) return null;
  return Math.max(...matches.map(Number));
}

/**
 * Classify a company. Headcount and revenue are the primary evidence; when
 * BOTH are missing, physical footprint stands in — a chain with 10+ sites
 * runs 200+ people on any staffing model (≈ mid-market), and 100+ sites is
 * enterprise scale. Null only when we know none of the three.
 */
export function classifySegment(input: {
  employees: number | null;
  annualRevenueUsd: number | null;
  sizeLabel?: string | null;
  locationCount?: number | null;
}): Segment | null {
  const employees = input.employees ?? employeesFromLabel(input.sizeLabel ?? null);
  const revenue = input.annualRevenueUsd;
  const locations = input.locationCount ?? null;
  if (employees == null && revenue == null) {
    if (locations == null) return null;
    if (locations >= 100) return "enterprise";
    if (locations >= 10) return "mid_market";
    return "smb";
  }

  if ((employees ?? 0) >= ENTERPRISE_EMPLOYEES || (revenue ?? 0) >= ENTERPRISE_REVENUE) {
    return "enterprise";
  }
  if ((employees ?? 0) >= MID_MARKET_EMPLOYEES || (revenue ?? 0) >= MID_MARKET_REVENUE) {
    return "mid_market";
  }
  // small on the numbers we have — but a 10+ site footprint outranks a
  // missing or partial headcount figure
  if (locations != null && locations >= 10) return "mid_market";
  return "smb";
}
