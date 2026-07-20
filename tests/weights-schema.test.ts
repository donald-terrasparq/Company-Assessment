import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS } from "@/lib/scoring/default-weights";
import { parseWeightProfile, strengthLabel } from "@/lib/scoring/weights-schema";

describe("parseWeightProfile", () => {
  it("accepts the default profile", () => {
    expect(parseWeightProfile(DEFAULT_WEIGHTS).ok).toBe(true);
  });

  it("rejects inverted tier thresholds", () => {
    const bad = JSON.parse(JSON.stringify(DEFAULT_WEIGHTS));
    bad.tiers = { tier_1_min: 30, tier_2_min: 60 };
    expect(parseWeightProfile(bad).ok).toBe(false);
  });

  it("rejects out-of-range signal bases and multipliers", () => {
    const bad = JSON.parse(JSON.stringify(DEFAULT_WEIGHTS));
    bad.signals.new_facility_announced.base = 999;
    expect(parseWeightProfile(bad).ok).toBe(false);

    const bad2 = JSON.parse(JSON.stringify(DEFAULT_WEIGHTS));
    bad2.recency.forward = 3;
    expect(parseWeightProfile(bad2).ok).toBe(false);
  });
});

describe("strengthLabel", () => {
  it("maps the slider bands", () => {
    expect(strengthLabel(0)).toBe("Ignored");
    expect(strengthLabel(10)).toBe("Weak");
    expect(strengthLabel(25)).toBe("Moderate");
    expect(strengthLabel(40)).toBe("Strong");
    expect(strengthLabel(48)).toBe("Decisive");
    expect(strengthLabel(-25)).toBe("Penalty");
  });
});
