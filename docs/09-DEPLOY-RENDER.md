# 09 — Deploying to Render

Render is Company Assessment's primary host. The web UI, the background worker, and Postgres are one Blueprint
(`render.yaml`). This guide takes you from a GitHub repo to other users logging in at your own domain.

> Why Render over Vercel: the worker needs to run for ~20 minutes per 100-company list. Vercel
> functions cap at 300s/800s, which is why the Vercel path chops work into cron-driven jobs. Render
> background workers have no timeout, so the worker is a plain claim loop. See `docs/08-HOSTING.md`.

---

## 1. Push the repo to GitHub

```bash
cd Company-Assessment
git init && git add . && git commit -m "Company Assessment: initial scaffold"
git branch -M main
git remote add origin https://github.com/<you>/Company-Assessment.git
git push -u origin main
```

## 2. Create the Blueprint on Render

1. https://dashboard.render.com → **New** → **Blueprint**.
2. Connect GitHub, authorize Render for the `Company-Assessment` repo only.
3. Render reads `render.yaml` and previews three resources: `company-assessment-web`, `company-assessment-worker`, `company-assessment-db`.
4. Click **Apply**. Render provisions Postgres, then builds the web and worker services.

`DATABASE_URL` is auto-wired from `company-assessment-db` into both services. `AUTH_SECRET` is auto-generated. You do
**not** set those by hand.

## 2a. The "Choose a Service" screen — use Blueprint, not a single service

Render's **New** menu offers Web Service, Background Worker, Cron Job, Static Site, Postgres, and
Blueprint. It's tempting to click **Web Service** — that's the wrong door for Company Assessment.

Company Assessment is **three** services wired together (web + worker + database). "Web Service" creates one at a
time and leaves you to connect them by hand — provision Postgres, copy its connection string into two
services, add matching env vars to both, and hope you didn't typo. **Blueprint** reads `render.yaml`
and does all of it in one step, in sync. So: **New → Blueprint**, always.

If you ever *must* go manual (Blueprint unavailable, or you want to understand the pieces), here's the
mapping and the order. **Provision the database first — the services need its connection string.**

**1. Postgres** — New → **Postgres**. Name `company-assessment-db`, region **Oregon**, plan **Basic-256mb**,
Postgres **16**. Create it, open **Connect**, copy the **Internal Database URL**.

**2. Web service** — New → **Web Service** → connect the `Company-Assessment` repo:
- Name `company-assessment-web` · Region **Oregon** (match the DB) · Branch `main` · Runtime **Node**
- Build Command `npm ci && npm run build`
- Start Command `npm start`
- Instance Type **Starter** (always-on)
- Advanced → Pre-Deploy Command `npm run db:migrate`
- Advanced → Health Check Path `/api/health`
- Environment: `DATABASE_URL` (paste the internal URL), `ANTHROPIC_API_KEY`, `AUTH_SECRET`
  (generate one), `AUTH_URL`, `SEED_ADMIN_USER`, `SEED_ADMIN_PASSWORD`, `BRAVE_API_KEY`

**3. Background worker** — New → **Background Worker** (the important one — *not* another Web Service;
a worker has no public URL and no timeout, which is the whole reason Company Assessment is on Render) → same repo:
- Name `company-assessment-worker` · Region **Oregon** · Branch `main` · Runtime **Node**
- Build Command `npm ci && npm run build`
- Start Command `npm run worker`
- Instance Type **Starter** — **never Free** (a free worker sleeps when idle, and the worker is idle
  between runs by design, so it would sleep and never process an uploaded list)
- Environment: `DATABASE_URL` (same internal URL), `ANTHROPIC_API_KEY`, `BRAVE_API_KEY`,
  `WORKER_CONCURRENCY` = `4`, `WORKER_POLL_MS` = `5000`

Every field above is already declared in `render.yaml` — manual entry is just retyping the blueprint,
which is why Blueprint is the recommended path.

> Render occasionally renames dashboard screens. The structure never changes: a **database**, an
> **HTTP service**, and a **no-timeout worker**. Match services to those three roles and you're right
> regardless of the exact labels.

## 3. Set the secrets Render won't generate

Anything marked `sync: false` in `render.yaml` must be set in the dashboard so it never lives in git.
On **both** `company-assessment-web` and `company-assessment-worker` → **Environment**:

| Key | Value |
|---|---|
| `ANTHROPIC_API_KEY` | your Anthropic key |
| `BRAVE_API_KEY` | optional, free-tier search |

On **`company-assessment-web` only**:

| Key | Value |
|---|---|
| `SEED_ADMIN_USER` | e.g. `admin` |
| `SEED_ADMIN_PASSWORD` | a strong temporary password — you'll change it on first login |
| `AUTH_URL` | `https://company-assessment-web.onrender.com` for now; swap to your domain in step 6 |

Changing an env var triggers a redeploy. That's expected.

## 3a. Configuration tuned for scoring runs

A scoring run is **bursty and I/O-bound**: the app sits idle for days, then researches up to 100
companies over ~20 minutes, spending nearly all of that time *waiting* on the Claude API rather than
using CPU. Almost every setting here follows from that one fact.

### Size for concurrency, not cores

- **`company-assessment-web`** just enqueues jobs and serves results — Starter (0.5 CPU / 512 MB) is plenty. Don't
  oversize it.
- **`company-assessment-worker`** does the scoring, but a bigger box barely helps: the CPU is mostly idle waiting on
  the network. The lever for throughput is **concurrency**, not cores. One Starter worker at
  `WORKER_CONCURRENCY=4` handles a 100-company list in ~20 minutes.

Worker env vars, and why they're set this way:

| Var | Value | Why |
|---|---|---|
| `WORKER_CONCURRENCY` | `4` | Companies researched in parallel. Higher risks Anthropic rate-limits mid-run; lower makes 100-company runs drag past 30 min. |
| `WORKER_POLL_MS` | `5000` | Idle poll interval. The worker sleeps most of the week; 5s stays responsive when a run starts without hammering Postgres. |

### Don't autoscale the worker — add a second one instead

Render autoscaling reacts to **CPU/memory**. The worker's CPU stays low even during a full run, so
autoscaling would never trigger when you want more throughput, and could scale *down* mid-run. So:

- Keep `company-assessment-worker` at a **fixed 1 instance**. Correct default.
- When you genuinely need faster runs, add a **second fixed worker instance** (Manual scaling → 2).
  This is safe with zero coordination code because the queue uses `FOR UPDATE SKIP LOCKED` — two
  workers physically cannot claim the same company, so they just split the list. Two workers ×
  concurrency 4 = 8 companies in flight ≈ a 100-company run in ~10 minutes.

### Region-match everything

A scoring run fires hundreds of small queries. Keep `company-assessment-web`, `company-assessment-worker`, and `company-assessment-db` in the
**same region** (all `oregon` in the blueprint) so DB latency doesn't tax every one of them.

### Health check stays deliberately shallow

`/api/health` confirms the web service is up. It does **not** ping the worker or the Anthropic API on
purpose — you don't want a transient API hiccup to make Render think the app is unhealthy and restart
it mid-run.

### Postgres grows with signal history, not with runs

Each scored company writes one `company_results` row plus a few `signals` rows — a 100-company run is
only a few hundred rows. What accumulates over time is **signal history** if you re-run lists monthly
to track change. Start on `basic-256mb`, watch the storage metric after your first real runs, and make
sure the weekly retention job (drops `signals` older than `retention_days`) is running before you've
banked a year of scans.

## 4. Initialize the database

Migrations run automatically on every deploy via `preDeployCommand: npm run db:migrate`. The **seed**
(admin user, default signal profile, settings row) runs once, by hand:

- `company-assessment-web` → **Shell** tab → `npm run db:seed`

You should see "created admin user" and "created default signal profile." If the shell isn't
available on your plan, add a temporary one-off Job with the same command, or run `db:seed` from a
local machine pointed at the Render `DATABASE_URL` (copy it from the `company-assessment-db` **Connect** panel).

## 5. Verify it's live

- `company-assessment-web` shows a green **Live** badge and a URL like `https://company-assessment-web.onrender.com`.
- Visit `/api/health` — it should return `{ "ok": true }`.
- `company-assessment-worker` logs show `worker: polling for jobs` (idle is correct — it wakes when a run starts).
- Log in with `SEED_ADMIN_USER` / `SEED_ADMIN_PASSWORD`. **Change the password immediately**
  (Settings → Account).

## 6. Add your custom domain

1. `company-assessment-web` → **Settings** → **Custom Domains** → **Add Custom Domain** → `app.ctsmobility.com`
   (a subdomain is cleanest for an app; use the apex only if you want the bare domain).
2. Render shows a DNS target. At your DNS provider create:
   - **Subdomain** (`app.`): a **CNAME** → the `onrender.com` target Render gives you.
   - **Apex** (`ctsmobility.com`): an **A / ALIAS / ANAME** per Render's instructions.
3. Render verifies DNS and issues a **free TLS certificate** automatically — minutes usually, up to a
   few hours for propagation. Wait for the green lock.
4. Update `AUTH_URL` on `company-assessment-web` to `https://app.ctsmobility.com` and let it redeploy, so login
   redirects resolve to the real domain.

Until the domain is ready, the `onrender.com` URL works and is shareable.

## 7. Give other users access

Render **account seats are for people who manage infrastructure** — you do not add end users there.
End users are managed by Company Assessment's own auth, which is exactly the control you want.

1. Log in as admin at your domain.
2. **Settings → Users → Invite user** → send each person their one-time invite link.
3. They set their own password and land in as a `member`: they can upload lists (max 100 companies),
   run analyses, and view results. Keep `admin` for whoever tunes weights and manages the budget.
4. `allow_open_registration` stays **off**. A public signup form on a tool that spends API credits per
   click is how you get a surprise bill.

## 8. Protect the shared bill — do this before inviting anyone

Every logged-in user can trigger runs that spend **your** Anthropic credits.

- **Settings → Budget** → set the monthly cap and confirm "halt runs at cap" is **on**. The cap is
  checked before every job claim, so a runaway retry loop can't blow past it.
- The per-user rate limit (3 runs/hour) is already enforced server-side.
- Optional second net: set a spend alert in the Anthropic Console, independent of the app.

---

## Costs (starter tiers)

| Resource | Plan | ~Monthly |
|---|---|---|
| `company-assessment-web` | Starter, always-on | ~$7 |
| `company-assessment-worker` | Starter, always-on | ~$7 |
| `company-assessment-db` | basic-256mb | ~$7 |
| **Infra subtotal** | | **~$21/mo** |
| Anthropic API | usage | single-digit $ per 100-company run |

## Gotchas

- **`Cannot find module 'typescript'` (or tailwind/tsx) during build** — the build installed without
  devDependencies. `NODE_ENV=production` makes npm omit them. The blueprint guards this twice:
  `buildCommand` uses `npm ci --include=dev`, and `NPM_CONFIG_PRODUCTION=false` is set on both
  services. If a service was created from an older render.yaml, either add
  `NPM_CONFIG_PRODUCTION=false` in its dashboard Environment tab (instant, triggers a redeploy) or
  run a Blueprint **Manual Sync** so the service picks up the current build command.
- **Never put the worker on the free plan.** Free services sleep when idle; a sleeping worker leaves
  runs stuck in `queued` forever. Starter (always-on) is the floor for `company-assessment-worker`.
- **Env-var changes require a redeploy** — Render doesn't hot-reload them.
- **Region-match** the web, worker, and db (all `oregon` in the blueprint) to keep DB latency low.
- **First deploy ordering:** Postgres provisions before the services build, so the first
  `preDeployCommand` migration has a database to talk to. If a race ever bites, re-run the deploy.
- **Scaling:** raise `WORKER_CONCURRENCY` (default 4) or run a second worker instance to drain the
  queue faster. `FOR UPDATE SKIP LOCKED` makes multiple workers safe — they never claim the same job.
  Don't rely on autoscaling for the worker — see **§3a** for why, and what to do instead.

## Health endpoint

`render.yaml` sets `healthCheckPath: /api/health`. Implement it in Phase 0:

```ts
// app/api/health/route.ts
export async function GET() {
  return Response.json({ ok: true, ts: Date.now() })
}
```

Render polls it to decide when a deploy is healthy and to restart a wedged instance.
