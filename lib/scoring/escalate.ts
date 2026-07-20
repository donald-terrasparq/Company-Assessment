/**
 * Two-pass escalation selector (pure, unit-tested like the scorer).
 *
 * Pass 1 analyzes every company with the balanced model. This function picks
 * which companies deserve a pass-2 re-analysis with the high-accuracy model —
 * only where a better reading could CHANGE a decision — capped at
 * escalation_pct% of the list.
 */

export interface EscalationInput {
  companyId: string;
  jobFailed: boolean; // pass-1 extraction failed all attempts
  result: {
    totalScore: number;
    fitScore: number;
    triggerScore: number;
    signalCount: number;
    caveats: string[];
    locationCount: number | null;
    employeeEstimate: number | null;
    allSourcesWeak: boolean;
  } | null; // null when the job failed
}

export interface EscalationCandidate {
  companyId: string;
  priority: number; // 1 = most valuable to escalate
  reasons: string[];
}

const TIER1_BAND = 6;
const TIER2_BAND = 5;

export function selectForEscalation(
  inputs: EscalationInput[],
  tier1Min: number,
  tier2Min: number,
  escalationPct: number,
): EscalationCandidate[] {
  const cap = Math.ceil((escalationPct / 100) * inputs.length);
  if (cap <= 0) return [];

  const candidates: EscalationCandidate[] = [];
  for (const input of inputs) {
    const reasons: string[] = [];
    let priority = Infinity;
    const hit = (p: number, reason: string) => {
      reasons.push(reason);
      priority = Math.min(priority, p);
    };

    if (input.jobFailed) hit(1, "extraction_failed");

    const r = input.result;
    if (r) {
      if (Math.abs(r.totalScore - tier1Min) <= TIER1_BAND) hit(2, "borderline_tier_1");
      if (r.caveats.includes("identity_unconfirmed")) hit(3, "identity_unconfirmed");
      if (r.fitScore >= 22 && (r.signalCount <= 1 || r.triggerScore < 10)) {
        hit(4, "high_fit_thin_evidence");
      }
      if (
        (r.locationCount === null || r.caveats.includes("single_site")) &&
        (r.employeeEstimate ?? 0) >= 500
      ) {
        hit(5, "footprint_suspicion");
      }
      if (Math.abs(r.totalScore - tier2Min) <= TIER2_BAND) hit(6, "borderline_tier_2");
      if (r.signalCount > 0 && r.allSourcesWeak) hit(7, "weak_sources_only");
    }

    if (reasons.length > 0) candidates.push({ companyId: input.companyId, priority, reasons });
  }

  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.reasons.length - a.reasons.length; // more triggers → more ambiguity
  });
  return candidates.slice(0, cap);
}
