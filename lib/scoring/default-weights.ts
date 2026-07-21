/**
 * The default weight profile, transcribed from docs/03-SIGNAL-MODEL.md.
 * Seeded as the `Default` signal_profiles row; edited via the Signals tab
 * (Phase 5). Scoring (lib/scoring/score.ts, Phase 3) is a pure function of
 * (signals, weights) — these numbers are data, not code.
 */

export type Category = "FWA" | "STARLINK" | "MOBILITY" | "BYOD";

export interface SignalWeight {
  base: number;
  categories: Category[];
  enabled: boolean;
}

export interface WeightProfile {
  version: 1;
  fit: { industry: number; size: number; multi_location: number; geography: number };
  recency: {
    forward: number;
    lt_30d: number;
    m1_3: number;
    m4_5: number;
    m6_12: number;
    gt_12m: number;
  };
  confidence: { primary: number; secondary: number; weak: number };
  tiers: { tier_1_min: number; tier_2_min: number };
  /** When true (default), trust caveats cap Tier 1 → Tier 2. When false, tiers
   * follow scores alone (defunct and the no-signal guardrail always apply). */
  caveat_caps?: boolean;
  signals: Record<string, SignalWeight>;
  category_boost: Record<Category, number>;
}

export const DEFAULT_WEIGHTS: WeightProfile = {
  version: 1,
  fit: { industry: 10, size: 8, multi_location: 7, geography: 5 },
  recency: { forward: 1.0, lt_30d: 1.0, m1_3: 0.8, m4_5: 0.6, m6_12: 0.3, gt_12m: 0.1 },
  confidence: { primary: 1.0, secondary: 0.85, weak: 0.6 },
  tiers: { tier_1_min: 63, tier_2_min: 38 },
  caveat_caps: true,
  signals: {
    // Location & facility → mostly FWA + STARLINK
    new_facility_announced: { base: 48, categories: ["FWA", "STARLINK"], enabled: true },
    new_store_or_branch: { base: 44, categories: ["FWA", "STARLINK", "MOBILITY"], enabled: true },
    hq_relocation: { base: 40, categories: ["FWA", "MOBILITY", "BYOD"], enabled: true },
    construction_permit_filed: { base: 34, categories: ["FWA"], enabled: true },
    temporary_site_need: { base: 30, categories: ["FWA", "STARLINK"], enabled: true },
    facility_expansion: { base: 28, categories: ["FWA"], enabled: true },

    // Continuity & resilience → STARLINK
    outage_or_downtime_event: { base: 42, categories: ["STARLINK", "FWA"], enabled: true },
    rural_or_low_redundancy_sites: { base: 32, categories: ["STARLINK"], enabled: true },
    pos_or_uptime_critical: { base: 30, categories: ["STARLINK", "FWA"], enabled: true },
    regulatory_uptime_requirement: { base: 26, categories: ["STARLINK"], enabled: true },
    disaster_recovery_initiative: { base: 24, categories: ["STARLINK"], enabled: true },

    // Workforce & devices → MOBILITY
    hiring_surge: { base: 38, categories: ["MOBILITY", "BYOD"], enabled: true },
    frontline_or_rugged_workforce: { base: 36, categories: ["MOBILITY"], enabled: true },
    fleet_or_field_service: { base: 32, categories: ["MOBILITY", "FWA"], enabled: true },
    device_refresh_or_rfp: { base: 44, categories: ["MOBILITY"], enabled: true },
    new_exec_it_or_ops: { base: 22, categories: ["MOBILITY", "FWA", "BYOD"], enabled: true },

    // Distributed work → BYOD
    remote_or_hybrid_workforce: { base: 30, categories: ["BYOD"], enabled: true },
    contractor_or_agent_network: { base: 28, categories: ["BYOD"], enabled: true },
    mdm_or_security_initiative: { base: 34, categories: ["BYOD", "MOBILITY"], enabled: true },
    byod_policy_published: { base: 24, categories: ["BYOD"], enabled: true },

    // Corporate events → all
    merger_or_acquisition: { base: 40, categories: ["FWA", "MOBILITY", "BYOD"], enabled: true },
    funding_round: { base: 30, categories: ["FWA", "MOBILITY"], enabled: true },
    expansion_announcement: { base: 34, categories: ["FWA", "MOBILITY"], enabled: true },

    // Negative signals — these subtract (acquired_or_defunct is a caveat, not a weight)
    closure_or_contraction: { base: -25, categories: [], enabled: true },
    bankruptcy_or_distress: { base: -35, categories: [], enabled: true },
  },
  category_boost: { FWA: 1.0, STARLINK: 1.0, MOBILITY: 1.0, BYOD: 1.0 },
};
