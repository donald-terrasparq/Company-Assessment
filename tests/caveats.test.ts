import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS } from "@/lib/scoring/default-weights";
import { scoreCompany, type ScorableExtraction } from "@/lib/scoring/score";

const NOW = new Date("2026-07-16T12:00:00Z");

/** A 71-point company: fit 29 + trigger 42 (48 × 1.0 × 0.85 + 26 × 0.1 × 0.6). */
function company71(caveats: string[]): ScorableExtraction {
  return {
    fit: { industry: 10, size: 8, multi_location: 6, geography: 5 },
    signals: [
      {
        event_type: "new_facility_announced",
        categories: ["FWA", "STARLINK"],
        title: "New HQ tower",
        summary: "A 44-story headquarters opens next year.",
        event_date: "2026-10-01",
        is_forward: true,
        source_url: "https://example.com/hq",
        source_name: "Business journal",
        source_class: "secondary",
      },
      {
        event_type: "regulatory_uptime_requirement",
        categories: ["STARLINK"],
        title: "Uptime obligations",
        summary: "Continuity requirements in older coverage.",
        event_date: "2025-05-10",
        is_forward: false,
        source_url: "https://example.com/old",
        source_name: "Trade",
        source_class: "weak",
      },
    ],
    caveats,
  };
}

describe("caveats cap the tier (docs/05 Phase 3 caveats.test)", () => {
  it("enterprise_procurement caps a 71 at Tier 2", () => {
    const clean = scoreCompany(company71([]), DEFAULT_WEIGHTS, NOW);
    expect(clean.total_score).toBe(71);
    expect(clean.tier).toBe("tier_1");

    const capped = scoreCompany(company71(["enterprise_procurement"]), DEFAULT_WEIGHTS, NOW);
    expect(capped.total_score).toBe(71); // caveats cap the tier, not the score
    expect(capped.tier).toBe("tier_2");
  });

  it("overseas_growth, holding_company, identity_unconfirmed also cap at Tier 2", () => {
    for (const caveat of ["overseas_growth", "holding_company", "identity_unconfirmed"]) {
      expect(scoreCompany(company71([caveat]), DEFAULT_WEIGHTS, NOW).tier).toBe("tier_2");
    }
  });

  it("non-capping caveats leave Tier 1 intact", () => {
    for (const caveat of ["foreign_hq", "franchise_model", "single_site", "public_procurement"]) {
      expect(scoreCompany(company71([caveat]), DEFAULT_WEIGHTS, NOW).tier).toBe("tier_1");
    }
  });

  it("caveat_caps=false lets tiers follow scores alone (Signals-tab toggle)", () => {
    const noCaps = { ...DEFAULT_WEIGHTS, caveat_caps: false };
    const s = scoreCompany(company71(["enterprise_procurement"]), noCaps, NOW);
    expect(s.total_score).toBe(71);
    expect(s.tier).toBe("tier_1"); // caveat still stored/displayed, tier uncapped

    // defunct and the no-signal guardrail are NOT affected by the toggle
    expect(scoreCompany(company71(["defunct"]), noCaps, NOW).tier).toBe("defunct");
    expect(
      scoreCompany(
        { fit: { industry: 10, size: 8, multi_location: 7, geography: 5 }, signals: [], caveats: [] },
        noCaps,
        NOW,
      ).tier,
    ).toBe("tier_3");
  });
});
