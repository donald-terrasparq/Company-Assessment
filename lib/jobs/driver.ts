/**
 * Job driver — the ONE place platform-specific queue logic lives.
 *
 * Company Assessment ships on Render, where the worker is an always-on process
 * with no timeout, so the driver is a plain claim loop. Moving to Vercel cron
 * or Cloud Run Jobs means writing a sibling driver here — the schema,
 * lib/scoring/, lib/research/, and the UI never change (docs/08-HOSTING.md).
 *
 * Keep this file free of Next.js and React imports — it runs in the
 * standalone worker process.
 */
import { claimJobs, processCompany } from "./process";
import { runRetentionSweep } from "./retention";

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 4);
const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 5000);
const RETENTION_SWEEP_MS = 24 * 60 * 60 * 1000; // daily

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let lastSweepAt = 0;
async function maybeSweepRetention(): Promise<void> {
  if (Date.now() - lastSweepAt < RETENTION_SWEEP_MS) return;
  lastSweepAt = Date.now();
  try {
    const { runsDeleted, signalsDropped } = await runRetentionSweep();
    console.log(
      `worker: retention sweep — ${runsDeleted} run(s) soft-deleted, ${signalsDropped} signal(s) dropped`,
    );
  } catch (err) {
    console.error("worker: retention sweep failed:", err);
  }
}

/**
 * Render worker (default). Runs forever via `npm run worker` (Render service
 * `company-assessment-worker`). No cron, no bailout timer — the process just lives.
 */
export async function runRenderWorker(signal?: AbortSignal): Promise<void> {
  console.log(`worker: starting · concurrency=${CONCURRENCY} · poll=${POLL_MS}ms`);
  while (!signal?.aborted) {
    await maybeSweepRetention();
    let jobs;
    try {
      jobs = await claimJobs(CONCURRENCY);
    } catch (err) {
      console.error("worker: claim failed (db unreachable?):", err);
      await sleep(POLL_MS);
      continue;
    }
    if (jobs.length === 0) {
      console.log("worker: polling for jobs — queue empty");
      await sleep(POLL_MS);
      continue;
    }
    console.log(`worker: claimed ${jobs.length} job(s)`);
    // I/O-bound on the Claude API — parallel within the tick, budget check inside.
    await Promise.allSettled(jobs.map((j) => processCompany(j)));
  }
  console.log("worker: shutting down");
}

/**
 * OPTIONAL Vercel-cron driver. Only used if you move to the Vercel host
 * (deploy/vercel-alternate/). Claims bounded batches and RETURNS before the
 * function's maxDuration — it stops claiming at ~T-45s so in-flight jobs
 * finish. Not wired by default.
 */
export async function runCronTick(deadlineMs: number): Promise<{ processed: number }> {
  let processed = 0;
  while (Date.now() < deadlineMs - 45_000) {
    const jobs = await claimJobs(CONCURRENCY);
    if (jobs.length === 0) break;
    const res = await Promise.allSettled(jobs.map((j) => processCompany(j)));
    processed += res.length;
  }
  return { processed };
}
