# 03 — Signal Model

This is the product. Everything else is plumbing.

## The math

```
total_score = fit_score + trigger_score          (0–30) + (0–70) = 0–100

fit_score      = industry + size + multi_location + geography
trigger_score  = min(70, Σ over signals of: base_points × recency × confidence)
```

Category scores are computed the same way but only over signals whose `categories[]` include that
category, normalized to 0–100:

```
category_score(C) = min(100, fit_score + Σ_{s : C ∈ s.categories} s.points_awarded)
primary_category  = argmax over the four
```

**The guardrail:** fit alone can never reach Tier 1. A company with a perfect 30 fit and no signals
scores 30 — Tier 3. *A prospect without an event is not a prospect, it's a demographic.*

```
tier_1  → total ≥ 63 AND ≥1 signal that is (dated < 5 months ago) OR (is_forward)
tier_2  → total 38–62
tier_3  → total < 38, or stale-only signals
defunct → company acquired/dissolved/closed (caveat `defunct` set) → total forced to 0
```

## FIT — 30 points, "would they ever buy?"

| Component | Max | Plain English |
|---|---|---|
| `industry` | 10 | Does this industry inherently need connectivity and devices? Healthcare, retail, logistics, hospitality, field services score high. Pure software/finance-office scores low. |
| `size` | 8 | Bigger = more sites, more devices. Bands: <100 (1), 100–500 (3), 500–2k (5), 2k–10k (7), 10k+ (8). |
| `multi_location` | 7 | Number of physical locations. 1 site (1), 2–10 (3), 11–50 (5), 50+ (7). Single-HQ companies are structurally weak targets for FWA. |
| `geography` | 5 | Are their sites inside strong Verizon coverage? US Southeast/Midwest/Texas score 5. Foreign-only or overseas-growth score 0–1. |

## TRIGGER — 70 points, "would they buy *now*?"

`points_awarded = base_points × recency_multiplier × confidence`

### Recency multipliers

| Window | × | Why |
|---|---|---|
| Announced future event (`is_forward`) | **1.0** | The best possible signal. Nothing is bought yet. |
| Last 30 days | 1.0 | Decisions in flight. |
| 1–3 months | 0.8 | Still open, vendors circling. |
| 4–5 months | 0.6 | Likely specced, maybe not signed. |
| 6–12 months | 0.3 | Mostly closed. |
| > 12 months | 0.1 | Historical color, not a trigger. |

### Confidence multipliers

| Source class | × | Examples |
|---|---|---|
| `primary` | 1.0 | Company press release, SEC 8-K/10-K, city permit filing, official gov econ-dev announcement |
| `secondary` | 0.85 | Local business journal, established trade press, major wire |
| `weak` | 0.6 | Aggregators, blogs, job-board inference, unattributed |

### Signal taxonomy

Each signal type carries base points and feeds one or more of the four categories.

#### Location & facility → mostly FWA + STARLINK

| Signal | Base | Feeds | Plain English |
|---|---|---|---|
| `new_facility_announced` | 48 | FWA, STARLINK | A new building, plant, campus, or HQ is announced or under construction. The single strongest signal we have: connectivity gets specced before the drywall goes up. |
| `new_store_or_branch` | 44 | FWA, STARLINK, MOBILITY | New retail store, bank branch, clinic, or restaurant. Repeatable — a chain opening 10 stores is 10 installs. |
| `hq_relocation` | 40 | FWA, MOBILITY, BYOD | Headquarters move. Everything gets re-wired and re-provisioned at once. |
| `construction_permit_filed` | 34 | FWA | A permit filing before any press. Earliest possible signal; low confidence unless the applicant is confirmed. |
| `temporary_site_need` | 30 | FWA, STARLINK | Pop-ups, disaster response, construction trailers, seasonal sites. FWA's home turf — no fiber, no time. |
| `facility_expansion` | 28 | FWA | Expanding or renovating an existing site rather than building new. |

#### Continuity & resilience → STARLINK

| Signal | Base | Feeds | Plain English |
|---|---|---|---|
| `outage_or_downtime_event` | 42 | STARLINK, FWA | They publicly suffered an outage. Nothing sells failover like having just lost a day of revenue. |
| `rural_or_low_redundancy_sites` | 32 | STARLINK | Sites where terrestrial redundancy is poor or a second fiber path doesn't exist. |
| `pos_or_uptime_critical` | 30 | STARLINK, FWA | Revenue stops when the link stops: retail POS, pharmacy, clinical systems, drive-thru. |
| `regulatory_uptime_requirement` | 26 | STARLINK | Healthcare, financial, or public-safety uptime/continuity obligations. |
| `disaster_recovery_initiative` | 24 | STARLINK | A published BC/DR or resiliency program. |

#### Workforce & devices → MOBILITY

| Signal | Base | Feeds | Plain English |
|---|---|---|---|
| `hiring_surge` | 38 | MOBILITY, BYOD | A large, specific, dated hiring commitment (e.g. "+1,000 jobs"). Every frontline hire is a device. |
| `frontline_or_rugged_workforce` | 36 | MOBILITY | Warehouse, logistics, field service, inventory, clinical. This is where **Zebra** rugged scanners live — not in an office. |
| `fleet_or_field_service` | 32 | MOBILITY, FWA | Trucks, vans, technicians in vehicles. In-vehicle routers + handhelds. |
| `device_refresh_or_rfp` | 44 | MOBILITY | An actual device RFP, refresh cycle, or carrier contract expiry. Rare and gold. |
| `new_exec_it_or_ops` | 22 | MOBILITY, FWA, BYOD | New CIO/CTO/VP-IT. New leaders re-open closed vendor decisions in their first year. |

#### Distributed work → BYOD

| Signal | Base | Feeds | Plain English |
|---|---|---|---|
| `remote_or_hybrid_workforce` | 30 | BYOD | A large distributed workforce with personal devices touching company systems. |
| `contractor_or_agent_network` | 28 | BYOD | Independent agents, franchisees, 1099 contractors. Classic BYOD: they own the phone, you manage the container. |
| `mdm_or_security_initiative` | 34 | BYOD, MOBILITY | A stated mobile-security, MDM, or zero-trust project. They've already admitted the problem. |
| `byod_policy_published` | 24 | BYOD | A published BYOD/stipend policy — confirmation the model is in use. |

#### Corporate events → BOTH / all

| Signal | Base | Feeds | Plain English |
|---|---|---|---|
| `merger_or_acquisition` | 40 | FWA, MOBILITY, BYOD | Integration means re-connecting sites and re-provisioning devices. Big, slow, lucrative. |
| `funding_round` | 30 | FWA, MOBILITY | Capital raised is capital that gets spent on growth — sites and headcount. |
| `expansion_announcement` | 34 | FWA, MOBILITY | Generic "we're entering market X" without a named building yet. |

### Negative signals — these *subtract*

| Signal | Points | Effect |
|---|---|---|
| `closure_or_contraction` | −25 | Closing sites, shrinking. |
| `bankruptcy_or_distress` | −35 | Chapter 11, debt restructuring, going-concern doubt. |
| `acquired_or_defunct` | n/a | Sets caveat `defunct`; total forced to 0, tier `defunct`. |

## Caveats — flags that cap the tier

These don't subtract points; they tell a rep what they're walking into. Two of them *cap* the tier.

| Caveat | Caps tier? | Meaning |
|---|---|---|
| `enterprise_procurement` | → max Tier 2 | Fortune-500-scale; a national carrier contract probably already exists and buying runs through corporate procurement. |
| `foreign_hq` | no | Decisions may be made overseas. |
| `overseas_growth` | → max Tier 2 | The growth is real but outside Verizon's footprint. |
| `holding_company` | → max Tier 2 | PE firm / league office / parent. The portfolio companies are the actual leads. |
| `franchise_model` | no | Franchisees buy their own connectivity — sell to the franchisee, not the brand. |
| `single_site` | no | One location; FWA upside is limited to failover. |
| `public_procurement` | no | RFP process; longer cycle, confirm the buying path. |
| `identity_unconfirmed` | → max Tier 2 | Research could not confirm the sources match this exact company (ambiguous name, no domain to anchor on). The signals may belong to a similarly-named company — verify identity before outreach. |
| `defunct` | → `defunct` | Company no longer exists independently. |

## The weights object

Stored as `signal_profiles.weights` (jsonb). This is what the **Signals** tab edits.

```jsonc
{
  "version": 1,
  "fit": { "industry": 10, "size": 8, "multi_location": 7, "geography": 5 },
  "recency": {
    "forward": 1.0, "lt_30d": 1.0, "m1_3": 0.8,
    "m4_5": 0.6, "m6_12": 0.3, "gt_12m": 0.1
  },
  "confidence": { "primary": 1.0, "secondary": 0.85, "weak": 0.6 },
  "tiers": { "tier_1_min": 63, "tier_2_min": 38 },
  "signals": {
    "new_facility_announced": { "base": 48, "categories": ["FWA","STARLINK"], "enabled": true },
    "hiring_surge":           { "base": 38, "categories": ["MOBILITY","BYOD"], "enabled": true }
    // … one entry per taxonomy row above
  },
  "category_boost": { "FWA": 1.0, "STARLINK": 1.0, "MOBILITY": 1.0, "BYOD": 1.0 }
}
```

`category_boost` lets a rep who's pushing Starlink this quarter weight it up without touching the
underlying evidence. It multiplies only the category score, never `total_score`.

## Reproducibility

Because scoring is a pure function of `(signals, weights)`, changing a weight and re-scoring is free
and instant — it never calls the API. `POST /api/runs/:id/rescore` exists for exactly this. Always
keep the signal rows; they're the expensive part.

## Tuning guidance for the Signals tab

Show users the *effect*, not just the number. When a weight changes, show a live preview:
"12 companies would change tier — 3 promoted to Tier 1, 9 demoted." Compute it client-side against
the loaded result set before saving.
