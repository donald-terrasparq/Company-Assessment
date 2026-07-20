import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../client";
import { companies, jobs, runs, settings, signalProfiles } from "../schema";
import { BALANCED_MODEL, HIGH_ACCURACY_MODEL } from "@/lib/anthropic/models";
import { estimateRemainingSeconds } from "@/lib/jobs/eta";
import { selectForEscalation, type EscalationInput } from "@/lib/scoring/escalate";
import type { WeightProfile } from "@/lib/scoring/default-weights";

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
  phase: "first_pass" | "second_pass";
  elapsedSeconds: number | null;
  estRemainingSeconds: number | null;
}

export async function getRunProgress(runId: string): Promise<RunProgress | null> {
  const run = await findRunById(runId);
  if (!run) return null;
  const rows = await db
    .select({ status: jobs.status, pass: jobs.pass, n: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.runId, runId))
    .groupBy(jobs.status, jobs.pass);
  const by: Record<string, number> = {};
  let anyPass2 = false;
  for (const r of rows) {
    by[r.status] = (by[r.status] ?? 0) + Number(r.n);
    if (Number(r.pass) === 2) anyPass2 = true;
  }
  const total = Object.values(by).reduce((a, b) => a + b, 0);
  const done = by.done ?? 0;
  const failed = by.failed ?? 0;
  const pending = (by.pending ?? 0) + (by.claimed ?? 0);

  const elapsedSeconds = run.startedAt
    ? Math.max(1, Math.round((Date.now() - run.startedAt.getTime()) / 1000))
    : null;
  const active = run.status === "queued" || run.status === "running";
  return {
    runId,
    status: run.status,
    total,
    done,
    failed,
    pending,
    phase: anyPass2 ? "second_pass" : "first_pass",
    elapsedSeconds,
    estRemainingSeconds:
      active && elapsedSeconds !== null
        ? estimateRemainingSeconds(elapsedSeconds, done + failed, pending)
        : null,
  };
}

export async function markRunHaltedBudget(runId: string): Promise<void> {
  await db
    .update(runs)
    .set({ status: "halted_budget", finishedAt: new Date() })
    .where(eq(runs.id, runId));
}

/**
 * Called when a job finishes. If the run has drained:
 *  - first drain on a balanced-model run → run the escalation selector and
 *    re-open up to escalation_pct% of jobs as pass 2 with the high-accuracy
 *    model (two-pass mode);
 *  - otherwise → roll up cost and mark the run complete.
 * Serialized per-run via FOR UPDATE on the run row, so two workers finishing
 * simultaneously can't double-escalate.
 */
export async function completeRunIfDrained(runId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const runRows = await tx.execute(sql`SELECT * FROM runs WHERE id = ${runId} FOR UPDATE`);
    const run = runRows.rows[0] as { status?: string; model?: string; signal_profile_id?: string } | undefined;
    if (!run || !["queued", "running"].includes(run.status ?? "")) return false;

    const open = await tx.execute(sql`
      SELECT count(*) AS n FROM jobs
      WHERE run_id = ${runId} AND status IN ('pending','claimed')
    `);
    if (Number((open.rows[0] as { n: string }).n) > 0) return false;

    // ---- escalation phase (only once, only when pass 1 ran on the balanced model) ----
    const pass2 = await tx.execute(sql`
      SELECT count(*) AS n FROM jobs WHERE run_id = ${runId} AND pass = 2
    `);
    const alreadyEscalated = Number((pass2.rows[0] as { n: string }).n) > 0;

    if (!alreadyEscalated && run.model === BALANCED_MODEL) {
      const settingsRows = await tx.select().from(settings).where(eq(settings.id, 1)).limit(1);
      const escalationPct = settingsRows[0]?.escalationPct ?? 20;

      if (escalationPct > 0) {
        const profileRows = await tx
          .select()
          .from(signalProfiles)
          .where(eq(signalProfiles.id, run.signal_profile_id!))
          .limit(1);
        const weights = profileRows[0]?.weights as WeightProfile | undefined;
        const tier1Min = weights?.tiers.tier_1_min ?? 63;
        const tier2Min = weights?.tiers.tier_2_min ?? 38;

        const inputRows = await tx.execute(sql`
          SELECT j.company_id, j.status AS job_status,
                 cr.total_score, cr.fit_score, cr.trigger_score, cr.caveats,
                 cr.location_count, cr.employee_estimate,
                 COALESCE(s.signal_count, 0) AS signal_count,
                 COALESCE(s.all_weak, FALSE) AS all_weak
          FROM jobs j
          LEFT JOIN company_results cr
            ON cr.run_id = j.run_id AND cr.company_id = j.company_id
          LEFT JOIN LATERAL (
            SELECT count(*) AS signal_count,
                   bool_and(source_class = 'weak') AS all_weak
            FROM signals WHERE signals.company_result_id = cr.id
          ) s ON TRUE
          WHERE j.run_id = ${runId}
        `);

        const inputs: EscalationInput[] = (inputRows.rows as Record<string, unknown>[]).map(
          (r) => ({
            companyId: r.company_id as string,
            jobFailed: r.job_status === "failed",
            result:
              r.total_score === null || r.total_score === undefined
                ? null
                : {
                    totalScore: Number(r.total_score),
                    fitScore: Number(r.fit_score),
                    triggerScore: Number(r.trigger_score),
                    signalCount: Number(r.signal_count),
                    caveats: (r.caveats as string[]) ?? [],
                    locationCount:
                      r.location_count === null ? null : Number(r.location_count),
                    employeeEstimate:
                      r.employee_estimate === null ? null : Number(r.employee_estimate),
                    allSourcesWeak: Boolean(r.all_weak),
                  },
          }),
        );

        const selected = selectForEscalation(inputs, tier1Min, tier2Min, escalationPct);
        if (selected.length > 0) {
          for (const c of selected) {
            await tx.execute(sql`
              UPDATE jobs SET
                pass = 2,
                model_override = ${HIGH_ACCURACY_MODEL},
                escalation_reasons = ${JSON.stringify(c.reasons)}::jsonb,
                status = 'pending', attempts = 0, locked_at = NULL, last_error = NULL,
                updated_at = now()
              WHERE run_id = ${runId} AND company_id = ${c.companyId} AND pass = 1
            `);
          }
          console.log(
            `worker: run ${runId} — escalating ${selected.length} company(ies) to high-accuracy pass 2`,
          );
          return false; // run continues with pass-2 jobs
        }
      }
    }

    await tx.execute(sql`
      UPDATE runs SET
        status = 'complete',
        finished_at = now(),
        cost_usd = COALESCE((SELECT SUM(cost_usd) FROM api_usage WHERE run_id = ${runId}), 0)
      WHERE id = ${runId} AND status IN ('queued','running')
    `);
    return true;
  });
}
