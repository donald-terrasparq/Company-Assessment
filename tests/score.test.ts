import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS } from "@/lib/scoring/default-weights";
import { scoreCompany, type ScorableExtraction } from "@/lib/scoring/score";

const NOW = new Date("2026-07-16T12:00:00Z");

/**
 * Golden fixture (docs/05 Phase 3 tests): an Erlanger-style signal set that
 * must always yield total 69 = fit 27 + trigger 42, Tier 1.
 *   facility (forward, secondary):        48 × 1.0 × 0.85 = 40.80
 *   uptime requirement (14mo old, weak):  26 × 0.1 × 0.60 =  1.56
 *   Σ = 42.36 → trigger 42
 */
const erlanger: ScorableExtraction = {
  fit: { industry: 9, size: 7, multi_location: 6, geography: 5 },
  signals: [
    {
      event_type: "new_facility_announced",
      categories: ["FWA", "STARLINK"],
      title: "~$122M campus expansion approved",
      summary: "Board approved a multi-year capital plan adding clinical space.",
      event_date: "2026-09-01",
      is_forward: true,
      source_url: "https://example.com/erlanger-expansion",
      source_name: "Chattanooga Times Free Press",
      source_class: "secondary",
    },
    {
      event_type: "regulatory_uptime_requirement",
      categories: ["STARLINK"],
      title: "Clinical uptime obligations",
      summary: "Health-system continuity requirements noted in older coverage.",
      event_date: "2025-05-10",
      is_forward: false,
      source_url: "https://example.com/uptime",
      source_name: "Trade press",
      source_class: "weak",
    },
  ],
  caveats: [],
};

describe("scoreCompany — golden fixtures (docs/05 Phase 3)", () => {
  it("Erlanger fixture: total 69, fit 27, trigger 42, tier_1", () => {
    const s = scoreCompany(erlanger, DEFAULT_WEIGHTS, NOW);
    expect(s.fit_score).toBe(27);
    expect(s.trigger_score).toBe(42);
    expect(s.total_score).toBe(69);
    expect(s.tier).toBe("tier_1");
    expect(s.signals[0].points_awarded).toBe(40.8);
    expect(s.signals[1].points_awarded).toBe(1.56);
  });

  it("guardrail: perfect fit 30 with zero signals is Tier 3, never Tier 1", () => {
    const s = scoreCompany(
      { fit: { industry: 10, size: 8, multi_location: 7, geography: 5 }, signals: [], caveats: [] },
      DEFAULT_WEIGHTS,
      NOW,
    );
    expect(s.fit_score).toBe(30);
    expect(s.trigger_score).toBe(0);
    expect(s.total_score).toBe(30);
    expect(s.tier).toBe("tier_3");
    expect(s.primary_category).toBeNull();
  });

  it("acquired_or_defunct forces tier defunct, total 0", () => {
    const s = scoreCompany(
      {
        ...erlanger,
        signals: [
          {
            ...erlanger.signals[0],
            event_type: "acquired_or_defunct",
          },
        ],
      },
      DEFAULT_WEIGHTS,
      NOW,
    );
    expect(s.tier).toBe("defunct");
    expect(s.total_score).toBe(0);
    expect(s.trigger_score).toBe(0);
  });

  it("defunct caveat alone also forces tier defunct", () => {
    const s = scoreCompany({ ...erlanger, caveats: ["defunct"] }, DEFAULT_WEIGHTS, NOW);
    expect(s.tier).toBe("defunct");
    expect(s.total_score).toBe(0);
  });

  it("fit sub-scores are clamped to their configured maxima", () => {
    const s = scoreCompany(
      { fit: { industry: 99, size: 99, multi_location: 99, geography: 99 }, signals: [], caveats: [] },
      DEFAULT_WEIGHTS,
      NOW,
    );
    expect(s.fit_score).toBe(30);
  });

  it("trigger is capped at 70", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      ...erlanger.signals[0],
      source_url: `https://example.com/${i}`,
      source_class: "primary" as const,
    }));
    const s = scoreCompany({ ...erlanger, signals: many }, DEFAULT_WEIGHTS, NOW);
    expect(s.trigger_score).toBe(70);
    expect(s.total_score).toBe(97);
  });

  it("negative signals subtract but trigger never goes below 0", () => {
    const s = scoreCompany(
      {
        fit: { industry: 5, size: 3, multi_location: 3, geography: 2 },
        signals: [
          {
            ...erlanger.signals[1],
            event_type: "bankruptcy_or_distress",
            event_date: "2026-07-01",
            source_class: "primary",
          },
        ],
        caveats: [],
      },
      DEFAULT_WEIGHTS,
      NOW,
    );
    expect(s.trigger_score).toBe(0);
    expect(s.total_score).toBe(13);
    expect(s.tier).toBe("tier_3");
  });

  it("stale-only signals cannot reach Tier 1 even with a high total", () => {
    const stale = {
      ...erlanger.signals[0],
      is_forward: false,
      event_date: "2026-01-05", // >5 months before NOW
      source_class: "primary" as const,
    };
    const s = scoreCompany(
      {
        fit: { industry: 10, size: 8, multi_location: 7, geography: 5 },
        signals: [
          stale,
          { ...stale, source_url: "https://example.com/2" },
          { ...stale, source_url: "https://example.com/3" },
        ],
        caveats: [],
      },
      DEFAULT_WEIGHTS,
      NOW,
    );
    expect(s.total_score).toBeGreaterThanOrEqual(63);
    expect(s.tier).toBe("tier_2");
  });
});

describe("determinism", () => {
  it("same input twice yields identical output", () => {
    const a = scoreCompany(erlanger, DEFAULT_WEIGHTS, NOW);
    const b = scoreCompany(erlanger, DEFAULT_WEIGHTS, NOW);
    expect(a).toEqual(b);
  });
});
