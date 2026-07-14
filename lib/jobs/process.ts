/**
 * Process one job: research + score + persist a single company. Stub for Phase 3.
 * Kept in its own file so the driver stays about scheduling, not domain logic.
 */
export async function processCompany(job: {
  id: string;
  runId: string;
  companyId: string;
}): Promise<void> {
  // TODO (Phase 3, docs/05-BUILD-PLAN.md + docs/06-PROMPTS.md):
  //  1. budget check — if over settings.monthly_budget_usd, mark run halted_budget and return
  //  2. lib/research/gather.ts   → search hits for the company
  //  3. lib/anthropic/extract.ts → SignalExtraction JSON (zod-validated)
  //  4. lib/scoring/score.ts     → pure (signals, weights) => scores
  //  5. upsert company_result + signals + contacts (idempotent on run_id, company_id)
  //  6. mark job done | failed(attempts+1)
  throw new Error("processCompany not implemented — Phase 3");
}
