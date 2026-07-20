import { eq, sql } from "drizzle-orm";
import { db } from "../client";
import { jobs } from "../schema";

export interface ClaimedJob {
  id: string;
  runId: string;
  companyId: string;
  attempts: number;
}

const MAX_ATTEMPTS = 3;
/** A claimed job whose worker died is reclaimable after this long. */
const STALE_CLAIM_MINUTES = 10;

/**
 * Claim up to `limit` jobs with FOR UPDATE SKIP LOCKED — two workers can never
 * claim the same job (docs/01-ARCHITECTURE.md). Also flips the parent run to
 * `running` on first claim, and re-claims jobs whose lock went stale.
 */
export async function claimJobs(limit: number): Promise<ClaimedJob[]> {
  const result = await db.execute(sql`
    WITH claimable AS (
      SELECT j.id
      FROM jobs j
      JOIN runs r ON r.id = j.run_id
      WHERE r.status IN ('queued', 'running')
        AND (
          j.status = 'pending'
          OR (j.status = 'claimed'
              AND j.locked_at < now() - make_interval(mins => ${STALE_CLAIM_MINUTES}))
        )
      ORDER BY j.updated_at
      FOR UPDATE OF j SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE jobs
    SET status = 'claimed', locked_at = now(), updated_at = now()
    FROM claimable
    WHERE jobs.id = claimable.id
    RETURNING jobs.id, jobs.run_id, jobs.company_id, jobs.attempts
  `);
  const claimed = (result.rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    runId: r.run_id as string,
    companyId: r.company_id as string,
    attempts: Number(r.attempts),
  }));
  if (claimed.length > 0) {
    const runIds = [...new Set(claimed.map((j) => j.runId))];
    for (const runId of runIds) {
      await db.execute(sql`
        UPDATE runs SET status = 'running', started_at = COALESCE(started_at, now())
        WHERE id = ${runId} AND status = 'queued'
      `);
    }
  }
  return claimed;
}

export async function markJobDone(id: string): Promise<void> {
  await db
    .update(jobs)
    .set({ status: "done", updatedAt: new Date(), lastError: null })
    .where(eq(jobs.id, id));
}

/** Retry with backoff up to 3 attempts (docs/00-PRD.md), then fail for good. */
export async function markJobFailed(id: string, error: string): Promise<void> {
  await db.execute(sql`
    UPDATE jobs SET
      attempts = attempts + 1,
      status = CASE WHEN attempts + 1 >= ${MAX_ATTEMPTS} THEN 'failed' ELSE 'pending' END,
      last_error = ${error.slice(0, 2000)},
      locked_at = NULL,
      updated_at = now()
    WHERE id = ${id}
  `);
}

/** Release claimed jobs without burning an attempt (e.g. budget halt). */
export async function releaseJob(id: string): Promise<void> {
  await db
    .update(jobs)
    .set({ status: "pending", lockedAt: null, updatedAt: new Date() })
    .where(eq(jobs.id, id));
}
