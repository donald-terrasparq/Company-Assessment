/** Plain-English copy for the signal library (Signals tab). */
export interface SignalCopy {
  label: string;
  description: string;
  group: string;
}

export const SIGNAL_GROUPS = [
  "Location & facility",
  "Continuity & resilience",
  "Workforce & devices",
  "Distributed work",
  "Corporate events",
  "Negative signals",
] as const;

export const SIGNAL_COPY: Record<string, SignalCopy> = {
  new_facility_announced: { group: "Location & facility", label: "New facility announced", description: "A new building, plant, campus, or major expansion is announced or under construction — connectivity decisions are being made now." },
  new_store_or_branch: { group: "Location & facility", label: "New store or branch", description: "A new retail store, branch, or customer-facing location is opening — each site needs internet, POS, and often devices." },
  hq_relocation: { group: "Location & facility", label: "HQ relocation", description: "The company is moving or opening a headquarters — everything gets re-wired and re-provisioned at once." },
  construction_permit_filed: { group: "Location & facility", label: "Construction permit filed", description: "A permit filing shows building activity before the press covers it." },
  temporary_site_need: { group: "Location & facility", label: "Temporary site need", description: "Construction trailers, pop-ups, events, or seasonal sites that need connectivity fast without wiring." },
  facility_expansion: { group: "Location & facility", label: "Facility expansion", description: "An existing site is growing — added space usually means added coverage and capacity." },
  outage_or_downtime_event: { group: "Continuity & resilience", label: "Outage or downtime event", description: "A reported outage or disruption — the moment failover becomes an easy conversation." },
  rural_or_low_redundancy_sites: { group: "Continuity & resilience", label: "Rural / low-redundancy sites", description: "Locations where wired options are limited — satellite or FWA may be the only strong choices." },
  pos_or_uptime_critical: { group: "Continuity & resilience", label: "POS / uptime-critical operations", description: "Payments, clinical, or logistics operations where minutes of downtime cost real money." },
  regulatory_uptime_requirement: { group: "Continuity & resilience", label: "Regulatory uptime requirement", description: "Compliance obligations that effectively mandate redundant connectivity." },
  disaster_recovery_initiative: { group: "Continuity & resilience", label: "Disaster-recovery initiative", description: "A publicized continuity or DR program — budget exists for resilience." },
  hiring_surge: { group: "Workforce & devices", label: "Hiring surge", description: "Meaningful headcount growth — new employees need devices and access." },
  frontline_or_rugged_workforce: { group: "Workforce & devices", label: "Frontline / rugged workforce", description: "Warehouse, field, or clinical staff who need managed rugged devices rather than desks." },
  fleet_or_field_service: { group: "Workforce & devices", label: "Fleet / field service", description: "Vehicles and technicians in the field — routing, telematics, and connectivity demand." },
  device_refresh_or_rfp: { group: "Workforce & devices", label: "Device refresh or RFP", description: "An announced device refresh, rollout, or RFP — an explicit buying event." },
  new_exec_it_or_ops: { group: "Workforce & devices", label: "New IT/Ops executive", description: "A new CIO/CTO/VP typically reviews vendors in their first two quarters." },
  remote_or_hybrid_workforce: { group: "Distributed work", label: "Remote / hybrid workforce", description: "A distributed workforce announcement — home connectivity and device management questions follow." },
  contractor_or_agent_network: { group: "Distributed work", label: "Contractor / agent network", description: "Franchisees, agents, or 1099 fleets using their own devices — classic BYOD." },
  mdm_or_security_initiative: { group: "Distributed work", label: "MDM / security initiative", description: "A mobile-security or device-management program — the budget line CTS sells into." },
  byod_policy_published: { group: "Distributed work", label: "BYOD policy published", description: "A published BYOD policy signals active personal-device management needs." },
  merger_or_acquisition: { group: "Corporate events", label: "Merger or acquisition", description: "Integration re-connects sites, merges networks, and re-provisions devices." },
  funding_round: { group: "Corporate events", label: "Funding round", description: "Fresh capital usually funds expansion — sites and headcount follow." },
  expansion_announcement: { group: "Corporate events", label: "Expansion announcement", description: "A stated growth plan without a specific site yet — early but real." },
  closure_or_contraction: { group: "Negative signals", label: "Closure or contraction", description: "Closing sites or cutting staff — subtracts from the trigger score." },
  bankruptcy_or_distress: { group: "Negative signals", label: "Bankruptcy or distress", description: "Financial distress — subtracts heavily; usually not a buyer." },
};
