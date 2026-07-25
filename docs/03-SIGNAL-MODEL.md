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
primary_category  = argmax over the five
```

**The guardrail:** fit alone can never reach Tier 1. A company with a perfect 30 fit and no signals
scores 30 — Tier 3. *A prospect without an event is not a prospect, it's a demographic.*

```
tier_1  → total ≥ 63 AND ≥1 signal that is (dated < 5 months ago) OR (is_forward)
tier_2  → total 38–62
tier_3  → total < 38, or stale-only signals
defunct → company acquired/dissolved/closed (caveat `defunct` set) → total forced to 0
```

## The five product categories

CellSite Solutions manufactures prefabricated telecom equipment buildings: **remanufactured concrete
shelters** (fast, economical, proven) and the new **DataComm Pro** line — reinforced, lightweight,
often larger modular buildings. Every prospect is scored against the five ways those products sell:

| Code | Category | What it is — and WHEN IT'S SOLD |
|------|----------|--------------------------------|
| `FIBER` | Fiber Huts & Telecom Shelters | Hardened buildings that house OLTs, splice points, and hub electronics on fiber routes. **Sold when** a fiber build is announced or funded (BEAD/ReConnect/state grants), when a rural utility or electric co-op launches or expands a fiber ISP, or when a mid-tier operator pushes deployments across states/regions — not just one city. Huts are specced during outside-plant engineering, before construction crews mobilize. Either remanufactured concrete shelters or DataComm Pro fits, sized per site. |
| `TOWER` | Wireless Tower Sites | A fiber hut / telecom shelter often sits at the base of a wireless tower housing radios, backhaul, and power equipment. **Sold when** tower companies, carriers, or neutral hosts announce new tower builds, coverage-expansion programs, 5G infill, or colocation/upgrade projects that add ground equipment. |
| `DATACOMM` | Modular Data Centers & Edge | Data center and edge operators increasingly deploy modular buildings instead of stick-built shells. **Sold when** a data center or edge provider announces capacity expansion, new markets, micro/edge rollouts, or an explicitly modular deployment strategy — where DataComm Pro's larger reinforced buildings fit. |
| `E911` | E911 / Public Safety | Cities, counties, and municipalities need secure buildings to house the servers and ISP equipment behind E911/NG911 service. **Sold when** a jurisdiction announces an NG911 migration, a PSAP consolidation or hardening project, or wins public-safety/emergency-communications funding. |
| `OTHER` | Other shelter verticals | Oil & gas, defense, utilities, transportation, and other industries deploy the same telecom shelters/fiber huts at remote sites. **Sold when** a pipeline SCADA/comms buildout, a defense or base-infrastructure project, a grid-modernization program, or another remote-communications deployment is announced. |

## FIT — 30 points, "would they ever buy?"

| Component | Max | Plain English |
|---|---|---|
| `industry` | 10 | Does this organization deploy outside-plant telecom or network infrastructure? Fiber broadband operators, rural electric/telephone co-ops, tower companies & wireless carriers, data center & edge operators, municipalities/public-safety agencies, oil & gas, utilities, and defense score high. Pure software/office companies score low. |
| `size` | 8 | Scale of the deployment program — route miles, homes passed, site count, megawatts, service-territory size. Bigger programs mean more buildings. |
| `multi_location` | 7 | Geographic breadth of deployments. Mid-tier operators building across **states/regions** score highest (7) — repeatable hut volume. Multi-county (5), multi-city (3), a single city/metro only (1). |
| `geography` | 5 | Are the builds in the US and inside CellSite Solutions' serviceable delivery footprint? US regional builds score 5. Foreign-only or overseas builds score 0–1. |

## TRIGGER — 70 points, "would they buy *now*?"

`points_awarded = base_points × recency_multiplier × confidence`

### Recency multipliers

| Window | × | Why |
|---|---|---|
| Announced future event (`is_forward`) | **1.0** | The best possible signal. Shelters are specced before ground breaks. |
| Last 30 days | 1.0 | Decisions in flight. |
| 1–3 months | 0.8 | Still open, vendors circling. |
| 4–5 months | 0.6 | Likely specced, maybe not ordered. |
| 6–12 months | 0.3 | Mostly closed. |
| > 12 months | 0.1 | Historical color, not a trigger. |

### Confidence multipliers

| Source class | × | Examples |
|---|---|---|
| `primary` | 1.0 | Company press release, state broadband office award list, NTIA/USDA announcement, SEC 8-K/10-K, permit filing, official government procurement notice |
| `secondary` | 0.85 | Broadband/fiber trade press, local business journal, established industry press, major wire |
| `weak` | 0.6 | Aggregators, blogs, job-board inference, unattributed |

### Signal taxonomy

Each signal type carries base points and feeds one or more of the five categories.

#### Fiber builds & grant funding → FIBER

| Signal | Base | Feeds | Plain English |
|---|---|---|---|
| `fiber_build_announced` | 48 | FIBER | A new FTTH/FTTP or fiber network build is announced or entering construction. The single strongest signal we have: every route needs huts, and they're specced early. |
| `grant_award_received` | 46 | FIBER | BEAD, ReConnect, state broadband office, or middle-mile grant awarded (or matched). Funded builds have federal deadlines — the money must be spent. |
| `rural_utility_fiber_launch` | 42 | FIBER | A rural electric co-op or utility launches or expands a fiber ISP over its service territory. Repeatable — a co-op passing 12 counties is dozens of hut sites. |
| `regional_expansion_announced` | 40 | FIBER | A mid-tier operator announces deployments across states/regions — not just one city. The exact profile CellSite Solutions targets. |
| `middle_mile_or_backbone` | 36 | FIBER | Middle-mile, long-haul, or backbone route builds — regen and ILA sites need shelters the whole way. |
| `construction_permit_filed` | 30 | FIBER | OSP/route permits filed before any press. Earliest possible signal; low confidence unless the applicant is confirmed. |

#### Wireless towers → TOWER

| Signal | Base | Feeds | Plain English |
|---|---|---|---|
| `tower_build_announced` | 44 | TOWER | New macro towers or tower programs announced — a shelter often sits at the base of every one, housing radios, backhaul, and power. |
| `carrier_network_expansion` | 38 | TOWER, FIBER | A carrier or neutral host announces coverage expansion, 5G infill, or a rural coverage program — new sites need ground equipment buildings. |
| `colocation_or_site_upgrade` | 32 | TOWER | Tower upgrades or colocation additions that put more equipment at the base of existing towers. |

#### Data centers & edge → DATACOMM

| Signal | Base | Feeds | Plain English |
|---|---|---|---|
| `data_center_expansion` | 44 | DATACOMM | New data center campus, capacity expansion, or new market entry. Modular buildings compress the schedule. |
| `edge_deployment_announced` | 42 | DATACOMM | An edge-computing or micro-data-center rollout — many small hardened sites, the DataComm Pro sweet spot. |
| `modular_strategy_stated` | 38 | DATACOMM | The operator publicly commits to modular/prefab deployment. They've already bought the concept; now they pick a vendor. |
| `site_or_power_secured` | 30 | DATACOMM | Land purchased or power capacity secured — a build is coming even if not yet announced. |

#### E911 & public safety → E911

| Signal | Base | Feeds | Plain English |
|---|---|---|---|
| `public_safety_rfp` | 46 | E911 | An actual RFP or procurement notice for shelters, equipment buildings, or E911/NG911 infrastructure. Rare and gold. |
| `ng911_upgrade` | 44 | E911 | A city/county/state announces NG911 migration or an E911 system upgrade — new servers and ISP equipment need a secure building. |
| `psap_consolidation` | 38 | E911 | PSAP consolidation, relocation, or hardening project — dispatch infrastructure gets rebuilt. |
| `public_safety_funding` | 34 | E911 | 911-fee allocations, state grants, or federal funds awarded for emergency communications. |

#### Other shelter verticals → OTHER

| Signal | Base | Feeds | Plain English |
|---|---|---|---|
| `oil_gas_infrastructure` | 38 | OTHER | Pipeline, well-pad, or midstream comms/SCADA buildouts — remote sites that need hardened equipment buildings. |
| `defense_or_gov_project` | 38 | OTHER | Base infrastructure, defense communications, or a defense-contractor program requiring shelters. |
| `utility_grid_modernization` | 34 | OTHER, FIBER | Substation comms, grid-modernization, or AMI programs that place network equipment in the field. |
| `remote_site_deployment` | 30 | OTHER | Rail, mining, transportation, or other remote communications sites being built out. |

#### Corporate events → all categories

| Signal | Base | Feeds | Plain English |
|---|---|---|---|
| `merger_or_acquisition` | 36 | FIBER, TOWER, DATACOMM | Operator consolidation means network integration and fresh expansion capital — and re-opened vendor decisions. |
| `funding_or_investment` | 34 | FIBER, TOWER, DATACOMM | PE growth investment, debt raise, or capital committed to builds. Capital raised is capital that gets spent on infrastructure. |
| `new_exec_network_ops` | 22 | FIBER, TOWER, DATACOMM, E911 | New CTO/VP-Network/VP-OSP/Director of Engineering. New leaders re-open closed vendor decisions in their first year. |

### Negative signals — these *subtract*

| Signal | Points | Effect |
|---|---|---|
| `build_halted_or_scaled_back` | −25 | A build paused, descoped, or a grant returned. |
| `bankruptcy_or_distress` | −35 | Chapter 11, debt restructuring, going-concern doubt. |
| `acquired_or_defunct` | n/a | Sets caveat `defunct`; total forced to 0, tier `defunct`. |

## Caveats — flags that cap the tier

These don't subtract points; they tell a rep what they're walking into. Two of them *cap* the tier.

| Caveat | Caps tier? | Meaning |
|---|---|---|
| `enterprise_procurement` | → max Tier 2 | National carrier / hyperscaler scale; incumbent national shelter contracts probably exist and buying runs through corporate procurement. |
| `foreign_hq` | no | Decisions may be made overseas. |
| `overseas_growth` | → max Tier 2 | The build activity is real but outside the US delivery footprint. |
| `holding_company` | → max Tier 2 | PE firm / parent. The operating companies are the actual leads. |
| `local_only` | no | Builds confined to a single city/metro; hut volume is limited compared to a regional program. |
| `self_perform` | no | The organization builds or precasts its own shelters in-house — confirm before pitching. |
| `public_procurement` | no | Municipal/RFP process; longer cycle, confirm the buying path. Expected and normal for E911. |
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
    "fiber_build_announced": { "base": 48, "categories": ["FIBER"], "enabled": true },
    "grant_award_received":  { "base": 46, "categories": ["FIBER"], "enabled": true },
    "tower_build_announced": { "base": 44, "categories": ["TOWER"], "enabled": true },
    "data_center_expansion": { "base": 44, "categories": ["DATACOMM"], "enabled": true }
    // … one entry per taxonomy row above
  },
  "category_boost": { "FIBER": 1.0, "TOWER": 1.0, "DATACOMM": 1.0, "E911": 1.0, "OTHER": 1.0 }
}
```

`category_boost` lets a rep who's pushing DataComm Pro this quarter weight it up without touching the
underlying evidence. It multiplies only the category score, never `total_score`.

## Reproducibility

Because scoring is a pure function of `(signals, weights)`, changing a weight and re-scoring is free
and instant — it never calls the API. `POST /api/runs/:id/rescore` exists for exactly this. Always
keep the signal rows; they're the expensive part.

## Tuning guidance for the Signals tab

Show users the *effect*, not just the number. When a weight changes, show a live preview:
"12 companies would change tier — 3 promoted to Tier 1, 9 demoted." Compute it client-side against
the loaded result set before saving.
