import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../client";
import { companies, jobs, runs } from "../schema";

export type RunRow = typeof runs.$inferSelect;

/** Enqueue a run: one `runs` row + one `jobs` row per company. Returns in ~ms. */
export async function createRunWithJobs(input: {
  listId: string;
  signalProfileId: string;
  model: string;
  searchProvider: string;
  triggeredBy: string;
}): Promise<RunRow> {
  return db.transaction(async (tx) => {
    const [run] = await tx
      .insert(runs)
      .values({
        listId: input.listId,
        signalProfileId: input.signalProfileId,
        model: input.model,
        searchProvider: input.searchProvider,
        triggeredBy: input.triggeredBy,
      })
      .returning();
    const companyRows = await tx
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.listId, input.listId));
    if (companyRows.length === 0) throw new Error("List has no companies.");
    await tx
      .insert(jobs)
      .values(companyRows.map((c) => ({ runId: run.id, companyId: c.id })));
    return run;
  });
}

export async function findRunById(id: string): Promise<RunRow | undefined> {
  const rows = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
  return rows[0];
}

/** Server-side rate limit: 3 runs per user per hour (docs/01-ARCHITECTURE.md). */
export async function countRecentRunsByUser(userId: string): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(runs)
    .where(and(eq(runs.triggeredBy, userId), gte(runs.createdAt, oneHourAgo)));
  return Number(rows[0]?.n ?? 0);
}

export interface RunProgress {
  runId: string;
  status: string;
  total: number;
  done: number;
  failed: number;
  pending: number;
}

export async function getRunProgress(runId: string): Promise<RunProgress | null> {
  const run = await findRunById(runId);
  if (!run) return null;
  const rows = await db
    .select({ status: jobs.status, n: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.runId, runId))
    .groupBy(jobs.status);
  const by: Record<string, number> = {};
  for (const r of rows) by[r.status] = Number(r.n);
  const total = Object.values(by).reduce((a, b) => a + b, 0);
  return {
    runId,
    status: run.status,
    total,
    done: by.done ?? 0,
    failed: by.failed ?? 0,
    pending: (by.pending ?? 0) + (by.claimed ?? 0),
  };
}

export async function markRunHaltedBudget(runId: string): Promise<void> {
  await db
    .update(runs)
    .set({ status: "halted_budget", finishedAt: new Date() })
    .where(eq(runs.id, runId));
}

/** Roll up api_usage into runs.cost_usd and mark the run complete. */
export async function completeRunIfDrained(runId: string): Promise<boolean> {
  const open = await db
    .select({ n: sql<number>`count(*)` })
    .from(jobs)
    .where(and(eq(jobs.runId, runId), sql`${jobs.status} IN ('pending','claimed')`));
  if (Number(open[0]?.n ?? 0) > 0) return false;
  await db.execute(sql`
    UPDATE runs SET
      status = 'complete',
      finished_at = now(),
      cost_usd = COALESCE((SELECT SUM(cost_usd) FROM api_usage WHERE run_id = ${runId}), 0)
    WHERE id = ${runId} AND status IN ('queued','running')
  `);
  return true;
}
