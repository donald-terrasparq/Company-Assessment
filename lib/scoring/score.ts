/**
 * Deterministic scoring — the product's core (docs/03-SIGNAL-MODEL.md).
 *
 * PURE FUNCTIONS ONLY: no I/O, no API, no Date.now(). Given the same
 * (extraction, weights, now) this always returns the same numbers — that's
 * what makes re-scoring free and the ranking trustworthy. The LLM extracts
 * and classifies; it never does arithmetic.
 */
import type { Category, WeightProfile } from "./default-weights";

export interface ScorableSignal {
  event_type: string;
  categories: Category[];
  title: string;
  summary: string;
  event_date: string | null; // YYYY-MM-DD
  is_forward: boolean;
  source_url: string;
  source_name: string | null;
  source_class: "primary" | "secondary" | "weak";
}

export interface ScorableExtraction {
  fit: { industry: number; size: number; multi_location: number; geography: number };
  signals: ScorableSignal[];
  caveats: string[];
}

export interface ScoredSignal extends ScorableSignal {
  base_points: number;
  recency_multiplier: number;
  confidence: number;
  points_awarded: number; // rounded to 2 decimals
}

export type Tier = "tier_1" | "tier_2" | "tier_3" | "defunct";

export interface Scores {
  fit_industry: number;
  fit_size: number;
  fit_multilocation: number;
  fit_geography: number;
  fit_score: number;
  trigger_score: number;
  total_score: number;
  tier: Tier;
  fwa_score: number;
  starlink_score: number;
  mobility_score: number;
  byod_score: number;
  primary_category: Category | null;
  recency_label: string | null;
  confidence: number | null; // confidence of the strongest signal
  signals: ScoredSignal[];
}

/** Caveats that cap the tier at Tier 2 (docs/03-SIGNAL-MODEL.md). */
export const TIER_CAPPING_CAVEATS = [
  "enterprise_procurement",
  "overseas_growth",
  "holding_company",
  "identity_unconfirmed",
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
/** "Fresh" for Tier 1 eligibility: dated < 5 months ago, or forward-looking. */
const FRESH_WINDOW_DAYS = 153;

export function recencyMultiplier(
  eventDate: string | null,
  isForward: boolean,
  now: Date,
  weights: WeightProfile,
): { multiplier: number; label: string } {
  if (isForward) return { multiplier: weights.recency.forward, label: "forward" };
  if (!eventDate) return { multiplier: weights.recency.gt_12m, label: "undated" };
  const ageDays = (now.getTime() - new Date(`${eventDate}T00:00:00Z`).getTime()) / DAY_MS;
  if (ageDays < 0) return { multiplier: weights.recency.forward, label: "forward" };
  if (ageDays <= 30) return { multiplier: weights.recency.lt_30d, label: "<30d" };
  if (ageDays <= 92) return { multiplier: weights.recency.m1_3, label: "1–3mo" };
  if (ageDays <= FRESH_WINDOW_DAYS) return { multiplier: weights.recency.m4_5, label: "4–5mo" };
  if (ageDays <= 365) return { multiplier: weights.recency.m6_12, label: "6–12mo" };
  return { multiplier: weights.recency.gt_12m, label: ">12mo" };
}

function isFresh(signal: ScorableSignal, now: Date): boolean {
  if (signal.is_forward) return true;
  if (!signal.event_date) return false;
  const ageDays =
    (now.getTime() - new Date(`${signal.event_date}T00:00:00Z`).getTime()) / DAY_MS;
  return ageDays >= 0 && ageDays <= FRESH_WINDOW_DAYS;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function scoreCompany(
  extraction: ScorableExtraction,
  weights: WeightProfile,
  now: Date,
): Scores {
  const caveats = extraction.caveats ?? [];

  // ---- fit: clamp each sub-score to its configured maximum ----
  const fit_industry = clamp(Math.round(extraction.fit.industry), 0, weights.fit.industry);
  const fit_size = clamp(Math.round(extraction.fit.size), 0, weights.fit.size);
  const fit_multilocation = clamp(
    Math.round(extraction.fit.multi_location),
    0,
    weights.fit.multi_location,
  );
  const fit_geography = clamp(Math.round(extraction.fit.geography), 0, weights.fit.geography);
  const fit_score = fit_industry + fit_size + fit_multilocation + fit_geography;

  // ---- per-signal points: base × recency × confidence ----
  const scored: ScoredSignal[] = [];
  for (const signal of extraction.signals) {
    const weight = weights.signals[signal.event_type];
    if (!weight || !weight.enabled) continue; // unknown or disabled → contributes nothing
    const { multiplier } = recencyMultiplier(signal.event_date, signal.is_forward, now, weights);
    const confidence = weights.confidence[signal.source_class] ?? weights.confidence.weak;
    scored.push({
      ...signal,
      base_points: weight.base,
      recency_multiplier: multiplier,
      confidence,
      points_awarded: round2(weight.base * multiplier * confidence),
    });
  }

  const defunct =
    caveats.includes("defunct") ||
    extraction.signals.some((s) => s.event_type === "acquired_or_defunct");
  if (defunct) {
    return {
      fit_industry,
      fit_size,
      fit_multilocation,
      fit_geography,
      fit_score,
      trigger_score: 0,
      total_score: 0,
      tier: "defunct",
      fwa_score: 0,
      starlink_score: 0,
      mobility_score: 0,
      byod_score: 0,
      primary_category: null,
      recency_label: null,
      confidence: null,
      signals: scored,
      // total forced to 0 per the signal model; fit sub-scores kept for display
    };
  }

  const rawTrigger = scored.reduce((sum, s) => sum + s.points_awarded, 0);
  const trigger_score = clamp(Math.round(Math.min(70, rawTrigger)), 0, 70);
  const total_score = clamp(fit_score + trigger_score, 0, 100);

  // ---- category scores: fit + positive signal points feeding that category, boosted ----
  const categoryScore = (cat: Category): number => {
    const catSum = scored
      .filter((s) => s.points_awarded > 0 && s.categories.includes(cat))
      .reduce((sum, s) => sum + s.points_awarded, 0);
    const boost = weights.category_boost[cat] ?? 1.0;
    return clamp(Math.round(Math.min(100, (fit_score + catSum) * boost)), 0, 100);
  };
  const fwa_score = categoryScore("FWA");
  const starlink_score = categoryScore("STARLINK");
  const mobility_score = categoryScore("MOBILITY");
  const byod_score = categoryScore("BYOD");

  const categories: Array<[Category, number]> = [
    ["FWA", fwa_score],
    ["STARLINK", starlink_score],
    ["MOBILITY", mobility_score],
    ["BYOD", byod_score],
  ];
  const hasPositiveSignal = scored.some((s) => s.points_awarded > 0);
  const primary_category = hasPositiveSignal
    ? categories.reduce((best, c) => (c[1] > best[1] ? c : best))[0]
    : null;

  // ---- tier: the guardrail — fit alone can never produce Tier 1 ----
  const fresh = extraction.signals.some((s) => isFresh(s, now));
  let tier: Tier;
  if (total_score >= weights.tiers.tier_1_min && fresh && hasPositiveSignal) {
    tier = "tier_1";
  } else if (total_score >= weights.tiers.tier_2_min && hasPositiveSignal) {
    tier = "tier_2";
  } else {
    tier = "tier_3";
  }
  const capsEnabled = weights.caveat_caps !== false;
  if (
    capsEnabled &&
    tier === "tier_1" &&
    caveats.some((c) => (TIER_CAPPING_CAVEATS as readonly string[]).includes(c))
  ) {
    tier = "tier_2";
  }

  // strongest positive signal drives the summary recency/confidence labels
  const strongest = [...scored]
    .filter((s) => s.points_awarded > 0)
    .sort((a, b) => b.points_awarded - a.points_awarded)[0];
  const recency_label = strongest
    ? recencyMultiplier(strongest.event_date, strongest.is_forward, now, weights).label
    : null;

  return {
    fit_industry,
    fit_size,
    fit_multilocation,
    fit_geography,
    fit_score,
    trigger_score,
    total_score,
    tier,
    fwa_score,
    starlink_score,
    mobility_score,
    byod_score,
    primary_category,
    recency_label,
    confidence: strongest?.confidence ?? null,
    signals: scored,
  };
}
