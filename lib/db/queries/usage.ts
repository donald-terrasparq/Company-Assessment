import { sql } from "drizzle-orm";
import { db } from "../client";
import { apiUsage } from "../schema";

export async function logUsage(input: {
  runId: string | null;
  companyId: string | null;
  provider: string;
  searches?: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd: number;
}): Promise<void> {
  await db.insert(apiUsage).values({
    runId: input.runId,
    companyId: input.companyId,
    provider: input.provider,
    searches: input.searches ?? 0,
    inputTokens: input.inputTokens ?? 0,
    outputTokens: input.outputTokens ?? 0,
    costUsd: input.costUsd.toFixed(6),
  });
}

/** Month-to-date spend across all providers — the budget-cap check reads this. */
export async function monthToDateCostUsd(): Promise<number> {
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(cost_usd), 0) AS total
    FROM api_usage
    WHERE created_at >= date_trunc('month', now())
  `);
  return Number((result.rows[0] as { total: string }).total);
}

export interface ProviderUsage {
  provider: string;
  searches: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/** Month-to-date usage rolled up per provider (Budget tab spend dashboard). */
export async function usageByProviderThisMonth(): Promise<ProviderUsage[]> {
  const result = await db.execute(sql`
    SELECT provider,
           COALESCE(SUM(searches), 0)      AS searches,
           COALESCE(SUM(input_tokens), 0)  AS input_tokens,
           COALESCE(SUM(output_tokens), 0) AS output_tokens,
           COALESCE(SUM(cost_usd), 0)      AS cost_usd
    FROM api_usage
    WHERE created_at >= date_trunc('month', now())
    GROUP BY provider
    ORDER BY cost_usd DESC
  `);
  return (result.rows as Record<string, unknown>[]).map((r) => ({
    provider: r.provider as string,
    searches: Number(r.searches),
    inputTokens: Number(r.input_tokens),
    outputTokens: Number(r.output_tokens),
    costUsd: Number(r.cost_usd),
  }));
}
