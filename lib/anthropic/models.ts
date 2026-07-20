/**
 * The ONLY place model strings live (CLAUDE.md "Model selection").
 * settings.model holds one of these; everything else imports from here.
 */
export const BALANCED_MODEL = "claude-sonnet-5"; // default: cost/quality sweet spot
export const HIGH_ACCURACY_MODEL = "claude-opus-4-8"; // opt-in via Settings

/**
 * USD per million tokens — used for budget accounting, not billing. Verify
 * against https://docs.claude.com/en/docs/about-claude/pricing when models
 * change; the budget cap treats these as estimates.
 */
export const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  [BALANCED_MODEL]: { input: 3, output: 15 },
  [HIGH_ACCURACY_MODEL]: { input: 15, output: 75 },
};

/** Anthropic web search tool: $10 per 1,000 searches, plus token costs. */
export const WEB_SEARCH_COST_PER_SEARCH_USD = 0.01;

export function estimateTokenCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = PRICING_PER_MTOK[model] ?? PRICING_PER_MTOK[BALANCED_MODEL];
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}
