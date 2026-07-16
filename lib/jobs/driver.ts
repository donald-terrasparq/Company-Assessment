/**
 * Job driver — the ONE place platform-specific queue logic lives.
 *
 * Company Assessment ships on Render, where the worker is an always-on process with no timeout, so the driver is a
 * plain claim loop (see `runRenderWorker` below). Because every other host difference is isolated
 * here, moving to Vercel cron or Cloud Run Jobs means writing a sibling driver — the schema,
 * `lib/scoring/`, `lib/research/`, and the UI never change.
 *
 * Implement the TODOs against your db layer (lib/db/queries/*). Keep this file free of Next.js and
 * React imports — it runs in the standalone worker process.
 */

import { processCompany } from "./process";     // TODO: research + score + upsert one job's company
// import { claimJobs, hasPendingJobs, markRunComplete } from "@/lib/db/queries/jobs";

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 4);
const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 5000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Render worker (default). Runs forever via `npm run worker` (Render service `company-assessment-worker`).
 * No cron, no bailout timer — the process just lives.
 */
export async function runRenderWorker(signal?: AbortSignal): Promise<void> {
  console.log(`worker: starting · concurrency=${CONCURRENCY} · poll=${POLL_MS}ms`);
  while (!signal?.aborted) {
    // TODO: const jobs = await claimJobs(CONCURRENCY);  // FOR UPDATE SKIP LOCKED
    const jobs: Array<{ id: string; runId: string; companyId: string }> = [];
    if (jobs.length === 0) {
      await sleep(POLL_MS);
      continue;
    }
    // Budget check happens inside processCompany (halt the run if over cap).
    await Promise.allSettled(jobs.map((j) => processCompany(j)));
    // TODO: for each run touched, if !(await hasPendingJobs(runId)) await markRunComplete(runId);
  }
  console.log("worker: shutting down");
}

/**
 * OPTIONAL Vercel-cron driver. Only used if you move to the Vercel host
 * (deploy/vercel-alternate/). Claims a bounded batch and RETURNS before the function's maxDuration —
 * it must stop claiming new work at ~T-45s so in-flight jobs finish. Not wired by default.
 */
export async function runCronTick(deadlineMs: number): Promise<{ processed: number }> {
  let processed = 0;
  while (Date.now() < deadlineMs - 45_000) {
    // TODO: const jobs = await claimJobs(CONCURRENCY); if (!jobs.length) break;
    const jobs: Array<{ id: string; runId: string; companyId: string }> = [];
    if (jobs.length === 0) break;
    const res = await Promise.allSettled(jobs.map((j) => processCompany(j)));
    processed += res.length;
  }
  return { processed };
}
