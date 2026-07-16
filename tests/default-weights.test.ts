import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS } from "@/lib/scoring/default-weights";

describe("default weight profile (docs/03-SIGNAL-MODEL.md)", () => {
  it("fit components sum to 30", () => {
    const { industry, size, multi_location, geography } = DEFAULT_WEIGHTS.fit;
    expect(industry + size + multi_location + geography).toBe(30);
  });

  it("tier thresholds match the signal model and are ordered", () => {
    expect(DEFAULT_WEIGHTS.tiers.tier_1_min).toBe(63);
    expect(DEFAULT_WEIGHTS.tiers.tier_2_min).toBe(38);
    expect(DEFAULT_WEIGHTS.tiers.tier_1_min).toBeGreaterThan(
      DEFAULT_WEIGHTS.tiers.tier_2_min,
    );
  });

  it("carries the full 25-signal taxonomy", () => {
    expect(Object.keys(DEFAULT_WEIGHTS.signals)).toHaveLength(25);
    // spot-check the strongest and the negative signals
    expect(DEFAULT_WEIGHTS.signals.new_facility_announced.base).toBe(48);
    expect(DEFAULT_WEIGHTS.signals.closure_or_contraction.base).toBe(-25);
    expect(DEFAULT_WEIGHTS.signals.bankruptcy_or_distress.base).toBe(-35);
  });

  it("every positive signal feeds at least one category", () => {
    for (const [key, s] of Object.entries(DEFAULT_WEIGHTS.signals)) {
      if (s.base > 0) {
        expect(s.categories.length, key).toBeGreaterThan(0);
      }
    }
  });

  it("recency decays monotonically", () => {
    const r = DEFAULT_WEIGHTS.recency;
    expect(r.forward).toBe(1.0);
    expect(r.lt_30d).toBeGreaterThanOrEqual(r.m1_3);
    expect(r.m1_3).toBeGreaterThanOrEqual(r.m4_5);
    expect(r.m4_5).toBeGreaterThanOrEqual(r.m6_12);
    expect(r.m6_12).toBeGreaterThanOrEqual(r.gt_12m);
  });
});
