/** Run cost estimator (docs/07-COSTS.md) — shown on the upload confirm step (admin only). */
import {
  BALANCED_MODEL,
  HIGH_ACCURACY_MODEL,
  estimateTokenCostUsd,
  WEB_SEARCH_COST_PER_SEARCH_USD,
} from "@/lib/anthropic/models";
import { SEARCHES_PER_COMPANY } from "@/lib/research/gather";

/** Bulky search snippets in, structured JSON out — docs/07 averages. */
const AVG_INPUT_TOKENS = 15_000;
const AVG_OUTPUT_TOKENS = 1_500;
/** ~30–90s per company at WORKER_CONCURRENCY 4. */
const AVG_SECONDS_PER_COMPANY = 60;
const CONCURRENCY = 4;

const PROVIDER_SEARCH_COST: Record<string, number> = {
  brave: 0, // free tier ~2k/mo — token-only, not "free"
  google_cse: 0.005,
  anthropic: WEB_SEARCH_COST_PER_SEARCH_USD,
  sec_edgar: 0,
};

export interface RunEstimate {
  companies: number;
  searches: number;
  searchCostUsd: number;
  tokenCostUsd: number;
  escalated: number;
  escalationCostUsd: number;
  totalUsd: number;
  minutes: number;
}

export function estimateRun(
  companies: number,
  model: string,
  searchProvider: string,
  escalationPct = 0,
): RunEstimate {
  const searches = companies * SEARCHES_PER_COMPANY;
  const searchCostUsd = searches * (PROVIDER_SEARCH_COST[searchProvider] ?? 0);
  const tokenCostUsd =
    companies * estimateTokenCostUsd(model, AVG_INPUT_TOKENS, AVG_OUTPUT_TOKENS);

  // two-pass: escalated companies re-run research + extraction on the
  // high-accuracy model (only applies when the base model is the balanced one)
  const escalated =
    model === BALANCED_MODEL && escalationPct > 0
      ? Math.ceil((escalationPct / 100) * companies)
      : 0;
  const escalationCostUsd =
    escalated *
    (estimateTokenCostUsd(HIGH_ACCURACY_MODEL, AVG_INPUT_TOKENS, AVG_OUTPUT_TOKENS) +
      SEARCHES_PER_COMPANY * (PROVIDER_SEARCH_COST[searchProvider] ?? 0));

  const totalUsd =
    Math.ceil((searchCostUsd + tokenCostUsd + escalationCostUsd) * 100) / 100; // round up
  const minutes = Math.max(
    1,
    Math.ceil(((companies + escalated) * AVG_SECONDS_PER_COMPANY) / CONCURRENCY / 60),
  );
  return {
    companies,
    searches,
    searchCostUsd,
    tokenCostUsd,
    escalated,
    escalationCostUsd,
    totalUsd,
    minutes,
  };
}
