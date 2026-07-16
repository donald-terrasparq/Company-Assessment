# CLAUDE.md — Operating manual for Claude Code

You are building **Company Assessment**, a prospect signal-intelligence app for CTS Mobility.
Read `docs/00-PRD.md` → `docs/01-ARCHITECTURE.md` → `docs/05-BUILD-PLAN.md` before writing code, and
**open `design/company_assessment_app.html` in your head** (it's the approved UI prototype and the visual
source of truth — reproduce its look in real React components; do not embed the HTML). See
`design/README.md` and `docs/04-UI-SPEC.md`.
Work one ticket at a time. Each ticket has acceptance criteria. Do not skip ahead.

## Stack (do not substitute without asking)

- **Next.js 15** (App Router, TypeScript, React Server Components)
- **Tailwind CSS** + shadcn/ui for primitives
- **Postgres** — Render Managed Postgres in production (Neon dev branch for local/Codespaces),
  accessed with `drizzle-orm`. It's just a `DATABASE_URL`, so the provider is swappable.
- **Auth.js (NextAuth v5)** credentials provider, bcrypt-hashed passwords
- **Anthropic TypeScript SDK** (`@anthropic-ai/sdk`) — server-side only
- **Render** for hosting: a `web` service + a `worker` service + managed Postgres, all in `render.yaml`.
  The worker is a long-running loop with no timeout. See `docs/09-DEPLOY-RENDER.md`. (The code stays
  host-agnostic per rule 10, so Vercel/Cloud Run remain possible, but Render is the target we build for.)
- **Render Persistent Disk** (or S3-compatible storage) for the raw uploaded spreadsheet

## Hard rules — violating any of these is a bug

1. **`ANTHROPIC_API_KEY` never reaches the browser.** It lives in a Render service environment variable and
   is read only inside route handlers / server actions / cron workers. Never `NEXT_PUBLIC_*`.
   Never pass it through props, never return it from an API route.
2. **Never scrape LinkedIn.** Contacts are found by *searching public sources* for names/titles, and
   in Phase 2 enriched through **Apollo.io's API**. Do not write a LinkedIn crawler, do not
   automate logged-in LinkedIn access. It violates their ToS.
3. **Never fabricate a person, a quote, a source URL, or a date.** If the model returns a signal
   without a resolvable `source_url`, drop the signal and log it. Contacts without a verifiable
   public source are stored with `verified = false` and rendered with a "unverified" badge.
4. **Never store more than a 25-word excerpt** from any source article. Store the URL, the
   publication, the date, and a *paraphrased* summary. This is a copyright constraint, not a
   preference.
5. **Every score must be explainable.** A `company_result` row is invalid unless it has at least one
   `signals` row that justifies its trigger score, each with a source. No signal → trigger score 0.
   Fit score alone can never produce Tier 1 (see `docs/03-SIGNAL-MODEL.md`).
6. **Budget caps are enforced server-side.** Before each run, check the org's monthly spend against
   `settings.monthly_budget_usd`. Halt the run and mark it `halted_budget` if exceeded.
7. **All long work is a job, never a request.** `POST /api/runs` enqueues and returns immediately;
   the **Render worker** (`npm run worker`) drains the queue. No HTTP route handler may loop over
   companies calling the API — that work belongs to the worker process. See `docs/01-ARCHITECTURE.md`.
8. **Idempotency.** A job may be retried. Writing a result twice for the same
   `(run_id, company_id)` must be an upsert, not a duplicate row.
9. **Lists are capped at 100 companies.** Enforce it client-side, in `POST /api/lists` (422), and via
   the DB `CHECK`. Show the cap in the UI (modal header, dropzone copy, live `87 / 100` counter).
   Never truncate a file silently.
10. **Keep the worker host-agnostic.** All platform-specific logic lives in `lib/jobs/driver.ts`.
   `lib/scoring/`, `lib/research/`, and the schema must run unchanged on Vercel cron, a Render
   background worker, or a Cloud Run job. See `docs/08-HOSTING.md`.

## Model selection

Use the model string from `settings.model`, defaulting to `claude-sonnet-5` for per-company research
(it's the cost/quality sweet spot for this) and `claude-opus-4-8` only if the user opts into
"high accuracy" mode in Settings. Never hardcode a model string outside `lib/anthropic/models.ts`.

## Conventions

- `lib/` = pure logic, unit-testable, no React. `app/` = routes and UI.
- Scoring math lives in `lib/scoring/` and must be **pure functions** — given signals + a weight
  profile, return a score. The LLM extracts signals; **it does not do arithmetic.** Deterministic
  code computes the final number so the same signals always yield the same score.
- Every DB write goes through `lib/db/queries/`. No inline SQL in routes.
- Zod-validate every LLM JSON response before it touches the database.
- `lib/jobs/driver.ts` is the ONLY file with host-specific queue logic. `src/worker/index.ts` is the
  entrypoint Render starts via `npm run worker`. Domain logic for one company lives in
  `lib/jobs/process.ts`. Don't scatter scheduling concerns into routes or scoring.

## When you're unsure

Stop and ask. Do not invent a schema column, an env var, or a third-party service that isn't in
these docs. If a doc contradicts reality (an API changed), say so rather than silently working around it.

## Verify before you claim done

Run `npm run typecheck && npm run lint && npm run test` and confirm the ticket's acceptance criteria
line by line. "It compiles" is not "it works."
