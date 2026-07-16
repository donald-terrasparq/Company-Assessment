# 01 — Architecture

## The constraint that shapes everything

A run researches up to 100 companies at ~30–90s each — 15–25 minutes of wall time. That is far longer
than any HTTP request should live, and longer than a serverless function is allowed to run
(Vercel caps at 300s/800s). **So the run cannot be a request. It is a queue drained by a worker.**

On **Render** (our host) the worker is a normal always-on process with no timeout, so it's a plain
loop. The queue still matters for retries, progress, parallelism, and budget checks — but there is no
cron and no bailout timer to design around.

```
POST /api/runs                       (web service)
  → create run row (status=queued)
  → insert one `jobs` row per company (status=pending)
  → return 202 { run_id }            ← responds in ~200ms

company-assessment-worker  (Render, always-on)      npm run worker
  loop:
    claim up to WORKER_CONCURRENCY pending jobs   (FOR UPDATE SKIP LOCKED)
    if none → sleep(WORKER_POLL_MS) → loop
    for each (in parallel): research + score one company,
                            upsert company_result + signals
    mark job done | failed(attempts+1)
    when a run has no pending/claimed jobs left → run.status = complete

GET /api/runs/:id/progress           ← UI polls every 3s for the progress bar
```

`FOR UPDATE SKIP LOCKED` makes concurrent workers safe: two never claim the same job, so you can run
a second `company-assessment-worker` instance to drain the queue faster. `Promise.allSettled` processes
`WORKER_CONCURRENCY` companies at once (default 4) — this is I/O-bound on the Claude API, not
CPU-bound, so a small instance is plenty.

Runs are bounded at **100 companies** (`docs/00-PRD.md`) → ~15–25 minutes and single-digit dollars.

> **Host-agnostic by design.** All platform-specific logic lives in `lib/jobs/driver.ts`. The Render
> driver is the loop above. A Vercel driver would add a cron endpoint + a T-45s bailout; a Cloud Run
> Jobs driver would use `CLOUD_RUN_TASK_INDEX`. The `jobs` table, schema, and `lib/scoring/` never
> change. See `docs/08-HOSTING.md`.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 App Router, TS | Server actions/route handlers keep the API key server-side |
| UI | Tailwind + shadcn/ui | Matches the approved mockup; fast to build |
| DB | Render Postgres + Drizzle | Managed, same-region as the services; Neon for local/Codespaces |
| Files | Render disk / S3-compatible | Raw uploaded .xlsx retained for audit/re-run |
| Auth | Auth.js v5, credentials + bcrypt | Username/password as specified |
| Hosting | Render (web + worker + PG) | Background workers are first-class; no timeout; git-push deploy |
| Queue | `jobs` table + worker loop | Postgres-backed; no extra vendor; multi-worker safe |
| LLM | Anthropic TS SDK | Research + signal extraction |

## Data flow for one company

```
job claimed
   ↓
lib/research/identify.ts   → STAGE 1, runs only if companies.domain IS NULL: resolve the official
   ↓                          domain from 1–2 searches + a small model call, zod-parse, write back
   ↓                          companies.domain with domain_source='lookup'. Unresolvable → domain
   ↓                          stays NULL and research proceeds on name alone.
lib/research/gather.ts     → run k searches (provider-pluggable), collect URLs + snippets
   ↓
lib/anthropic/extract.ts   → Claude call: "given these sources, return SignalExtraction JSON"
   ↓                          (tools: web_search if provider=anthropic; else pre-fetched context)
zod parse → reject malformed → retry once with the validation error appended
   ↓                          extraction also reconfirms identity: sources that don't plausibly
   ↓                          match the name + domain ⇒ caveat `identity_unconfirmed`
   ↓
lib/scoring/score.ts       → PURE FUNCTION: (signals, weights) => scores
   ↓                          LLM never does arithmetic. Deterministic + reproducible.
lib/db/queries/results.ts  → upsert company_result, insert signals, insert contacts
```

**Why the LLM doesn't compute the score:** ask a model to multiply 48 × 1.0 × 0.88 and sum it and
you get a number that drifts between runs. Ask it to *identify and classify* a signal — event type,
date, confidence, source — and it's reliable. Arithmetic is code's job. This also means editing a
weight in Settings re-scores instantly from stored signals with **zero API cost**.

That last property is worth protecting: `POST /api/runs/:id/rescore` reads existing signals, applies
the current weight profile, and rewrites scores. No re-research.

## Search providers (pluggable)

`lib/search/provider.ts` exports an interface:

```ts
interface SearchProvider {
  name: string
  search(query: string, opts?: { limit?: number }): Promise<SearchHit[]>
  costPerSearchUsd: number
}
```

| Provider | Cost | Notes |
|---|---|---|
| `brave` | Free tier ~2,000 queries/mo, then paid | Good default for Phase 1 |
| `google_cse` | 100 queries/day free | Programmable Search Engine; low ceiling |
| `duckduckgo` | Free, unofficial | No API key; rate-limited and fragile — fallback only |
| `sec_edgar` | Free, official | Full-text search for 8-K/10-K facts. Always on, no key. |
| `anthropic` | **$10 per 1,000 searches** + token costs | Server-side tool, cited automatically, zero maintenance |

**Be clear-eyed about "free":** Anthropic's web search tool is *not* free — it's $10/1,000 searches
plus standard token costs for the retrieved content. It is, however, the least code and returns
citations natively. Phase 1 default is `brave` + `sec_edgar`; the Anthropic provider is one setting
away when you decide the quality is worth ~$6 per 79-company run.

Provider is chosen in **Settings → Data sources** and stored in `settings.search_provider`.

Phase 2 adds `apollo` as an *enrichment* provider (not a search provider) behind
`lib/enrichment/apollo.ts`.

## Security

- `ANTHROPIC_API_KEY`, `BRAVE_API_KEY`, `APOLLO_API_KEY`, `DATABASE_URL`, `AUTH_SECRET` — all set as
  Render service env vars (`sync: false` in `render.yaml`), all server-only. **No `NEXT_PUBLIC_`
  prefix on any of them.** The worker reads the same key from its own env; it never crosses the wire.
- The worker is an internal process with no public endpoint, so there's no cron URL to protect. (If
  you ever move to the Vercel driver, its cron route checks `Authorization: Bearer $CRON_SECRET`.)
- Passwords: bcrypt, cost 12. Sessions: JWT strategy, 7-day expiry, httpOnly cookie.
- Rate-limit `POST /api/runs` to 3 runs per user per hour.
- Every LLM output is Zod-parsed before it touches SQL. Treat model output as untrusted input.

## Environments

Local / Codespaces use a **Neon dev branch** via `.env.local`. Production is **Render** off `main`:
`render.yaml` runs `db:migrate` as a `preDeployCommand` before each deploy takes traffic. Render
preview environments (per-PR) can point at a separate Neon branch so previews never touch prod data.
See `docs/09-DEPLOY-RENDER.md`.
