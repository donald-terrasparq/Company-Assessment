# 08 — Hosting Options

## Why this doc exists

**Company Assessment is built for Render** (see `docs/09-DEPLOY-RENDER.md`). This doc records *why*, and what the
alternatives are if your needs change.

The deciding factor is the worker. A run takes ~20 minutes. Vercel functions cap at **300s/800s**, so
the Vercel path has to chop work into one-company jobs driven by a cron worker with a T-45s bailout —
machinery that exists purely to route around a platform limit. Render background workers have **no
timeout**, so the worker is just a loop: `while (job = claim()) { process(job) }`.

**The `jobs` table, the schema, and `lib/scoring/` don't change between hosts.** Only
`lib/jobs/driver.ts` and where the worker runs. That portability is deliberate — it's what keeps the
alternatives below cheap to switch to.

---

## The shape that fits this app

Company Assessment is two processes:

| Process | Needs | Traffic |
|---|---|---|
| **Web** (Next.js UI + API) | Fast cold start, HTTPS, sits idle most of the day | A handful of users |
| **Worker** (research + scoring) | Long-running, no timeout, network egress, 1 vCPU is plenty | Bursty: 100 companies, then nothing for a week |

A 100-company run at ~45s per company with 4 in parallel is roughly **20 minutes of wall time** and
almost no CPU — it's nearly all I/O waiting on the Claude API. That profile means you should pay for
*time*, not for *cores*, and you should be able to scale the worker to zero between runs.

---

## Recommended: Render

**Why:** background workers and cron jobs are first-class service types — you define them in
`render.yaml`, not by bolting a scheduler onto a web app. Managed Postgres sits next to them. Git
push to deploy. Per-seat pricing was removed in 2026.

```yaml
# render.yaml
services:
  - type: web
    name: company-assessment-web
    runtime: node
    buildCommand: npm ci && npm run build
    startCommand: npm start
  - type: worker                 # ← no timeout. this is the whole point.
    name: company-assessment-worker
    runtime: node
    startCommand: npm run worker
databases:
  - name: company-assessment-db
    plan: basic-256mb
```

The worker becomes an honest loop:

```ts
while (true) {
  const jobs = await claimJobs(4)               // FOR UPDATE SKIP LOCKED
  if (!jobs.length) { await sleep(5_000); continue }
  await Promise.allSettled(jobs.map(processCompany))
}
```

**Cost:** Hobby is $0 plus compute; Pro starts at $25/mo plus compute. Free-tier web services sleep
after inactivity — fine for a prototype, wrong for a worker (a sleeping worker doesn't drain the
queue). Budget roughly **$7–25/mo web + $7/mo worker + $7/mo Postgres**.

**Watch for:** free-tier services spin down; regions are limited to US East/West, EU, Singapore.

---

## Best for bursty runs: Google Cloud Run Jobs

**Why:** Cloud Run **Jobs** let a task run up to **168 hours (7 days)** — default 10 minutes,
configurable. Parallelism is a first-class setting: run 100 tasks, one per company, concurrently.
Scale-to-zero means you pay ~nothing between runs.

This is the most *architecturally correct* fit. A run becomes:

```
POST /api/runs  →  gcloud run jobs execute Company-Assessment-research --tasks=100 --parallelism=8
```

Each task reads `CLOUD_RUN_TASK_INDEX`, claims its company, does the work, exits. No queue polling,
no cron, no lock contention. Retries are built in (default 3).

Put the Next.js UI on Cloud Run as a **service** (or leave it on Vercel) and the worker as a **job**.

**Cost:** pay per vCPU-second and GiB-second while running. A 20-minute, mostly-idle run is cents.
Realistically **<$5/mo** for this workload.

**Watch for:** the most YAML and IAM of any option here. Worth it if runs are infrequent and bursty;
overkill if you want to `git push` and stop thinking.

---

## Simplest mental model: Railway

Deploy the repo, add a second service pointed at `npm run worker`, add Postgres from the UI. Usage-
based billing by the second. No timeout on a long-running service.

**Cost:** free plan is a 30-day trial with $5 credits, then ~$1/mo with 1 vCPU / 0.5 GB. Hobby is
$5/mo minimum usage including $5 of credits. Realistic: **$10–20/mo** for web + worker + Postgres.

**Watch for:** cron is plugin-based and less robust than Render's; usage credits can lapse and stop
services if you're not watching.

---

## Also viable

| Platform | Fit | Notes |
|---|---|---|
| **Fly.io** | Good | Micro-VMs, no request timeout, `fly machines` can be started per-run and stopped after. Volumes and long-lived connections if you ever need them. More ops than Render. |
| **AWS ECS Fargate** | Good, heavy | No timeout, VPC depth, fits if you're already in AWS. Meaningful operational surface for a 2-service app. |
| **AWS Lambda** | ✗ **No** | 15-minute hard ceiling per invocation. You'd rebuild the same job-chopping you did to escape Vercel. Only viable behind Step Functions, which is a lot of machinery. |
| **Cloudflare Workers** | ✗ Awkward | CPU-time limits and a JS-only runtime; Queues + Durable Objects can be made to work, but you'll fight it. |
| **DigitalOcean App Platform** | Fine | Worker components, managed Postgres, predictable flat pricing (~$5–12/component). |
| **Hetzner / any VPS + Coolify or Dokku** | Cheapest | ~$5/mo for the whole thing. You own patching, backups, TLS renewal, and the pager. Real cost is your time. |
| **Vercel + Inngest / Trigger.dev** | Good | Keep the UI on Vercel; the job layer runs durable multi-step functions off-platform with no duration cap. Least migration if you've already deployed to Vercel. |

---

## Recommendation — decided: Render

Company Assessment ships on **Render**: a web service + a background worker + managed Postgres in one `render.yaml`,
~$21/mo on starter tiers, no timeout to design around, git-push to deploy. Step-by-step in
`docs/09-DEPLOY-RENDER.md`.

Keep these in your back pocket:
- **Cloud Run Jobs** if runs become rare and bursty and you want near-zero idle cost (task timeout up
  to 7 days, scale-to-zero). More IAM/YAML.
- **Vercel + Inngest** if you ever want the UI on Vercel's edge; move the job layer to Inngest and the
  worker driver swaps out. The `jobs` table stays.
- **Railway / Fly / Fargate** are all viable; trade-offs above.

**Postgres travels with you.** Neon works from any of these — it's just a connection string — so you
can change compute without touching data. Keep `DATABASE_URL` as the only coupling.

---

## GitHub Codespaces (prototype phase)

A devcontainer is included. Codespaces gives a full Linux VM with no function timeout, so the worker
loop runs exactly as it will on Render.

```bash
npm run dev        # UI on the forwarded port
npm run worker     # the same loop that ships to production
```

Add secrets under **Repo → Settings → Secrets → Codespaces**, never in `.env` committed to git.
Use a Neon *dev branch* for the database so a bad migration in a codespace can't touch production.

Free tier is 60 core-hours/month (2-core machine → ~30 hours). A 100-company run is ~20 minutes, so
you can iterate freely — but the codespace stops when idle, which will pause a running worker. Don't
kick off a full run and close the tab.

---

## What does *not* change

Whatever you pick: the API key stays server-side, the scoring stays a pure function, signals keep
their `source_url`, and the budget cap is enforced before each job claim. Hosting is an
implementation detail. The guardrails in `CLAUDE.md` are not.
