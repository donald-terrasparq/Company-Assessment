# 05 — Build Plan

Work top to bottom. Each ticket is a commit (or a PR). Do not start a phase until the prior phase's
acceptance criteria pass. Tell the user when a phase is done and wait for a look.

---

## Phase 0 — Scaffold  *(~1 session)*

- **0.1** `create-next-app` — TypeScript, App Router, Tailwind. Add `shadcn/ui`, `drizzle-orm`,
  `@anthropic-ai/sdk`, `zod`, `next-auth@beta`, `bcryptjs`, `papaparse`, `xlsx`. (File storage: Render disk or an S3-compatible client — pick in Phase 2.)
- **0.2** Scripts: `db:migrate` (applies `db/schema.sql`), `db:seed`, `typecheck`, `lint`, `test` (vitest).
- **0.3** Open `design/company_assessment_app.html`; extract its design tokens (colors, fonts, spacing, the
  score-anatomy-bar treatment) into `tailwind.config.ts` + `globals.css`. Fonts via `next/font`
  (Space Grotesk, Inter, JetBrains Mono). The prototype is the visual target for every screen.
- **0.4** App shell: left rail, top bar, four routes rendering placeholders.
- **0.5** `.env.example` → `.env.local`; verify the DB connects (Neon dev branch locally).
- **0.6** `app/api/health/route.ts` returning `{ ok: true }` — Render's health check hits this.
- **0.7** Add a `worker` npm script (`tsx src/worker/index.ts`) — even as a stub that logs and sleeps.
  Confirm `npm run worker` runs as its own process; this is what Render's `company-assessment-worker` starts.

✅ `npm run dev` shows the shell with working nav. `npm run db:migrate` creates every table.
`/api/health` returns ok. `npm run worker` runs as a separate process and logs a poll tick.

---

## Phase 1 — Auth & settings  *(~1 session)*

- **1.1** Auth.js credentials provider, bcrypt (cost 12), JWT sessions, `/login`.
- **1.2** Middleware: everything except `/login` requires a session. `/settings/users` requires `admin`.
- **1.3** Seed: one admin from `SEED_ADMIN_USER` / `SEED_ADMIN_PASSWORD`; default signal profile from
  the JSON in `docs/03-SIGNAL-MODEL.md`; settings row id=1.
- **1.4** Settings → Account + Users tabs. Invite codes (one-time, 7-day expiry).

✅ Can log in, create a user, change a password. Logged-out users hit `/login`. Non-admins get 403 on `/settings/users`.

---

## Phase 2 — Upload & parse  *(~1 session)*

- **2.1** Upload modal: dropzone → parse `.csv` (papaparse) / `.xlsx` (SheetJS) in the browser, preview 10 rows.
- **2.2** Name step. `display_name = "{name} — {YYYY-MM-DD}"`, computed server-side in UTC-local.
- **2.3** Column mapping: `company_name` required, `website` optional; remaining columns → `raw_row`.
- **2.4** `POST /api/lists` — store raw file (Render disk / S3), insert `lists` + `companies`, normalize `domain`
  (`lib/normalize/domain.ts`), dedupe within list, count unparseable URLs.
- **2.4b** **Enforce the 100-company cap** at all three layers: client parse (block Continue),
  `POST /api/lists` (422 with a message naming the actual count), and the DB `CHECK`. Surface the cap
  in the modal header, the dropzone copy, and a live `87 / 100` counter. Never truncate silently.
- **2.5** Lists screen table + soft delete.

✅ Upload the real `pre-intent.xlsx`. 79 companies land, counter reads `79 / 100`. A 101-row file is
rejected with a message naming the count — not truncated. Bad URLs (`www.mcirocenter.com`) don't crash —
they store with `domain = NULL` and surface a warning chip. Re-uploading dedupes.

**Tests:** `domain.test.ts` — `https://WWW.Example.com/about` → `example.com`; `not a url` → `null`.
`cap.test.ts` — 100 rows accepted, 101 rejected with 422 at the API layer even if the client is bypassed.

---

## Phase 3 — The engine  *(~2–3 sessions. The hard part.)*

- **3.1** `lib/search/provider.ts` interface + `brave.ts`, `google_cse.ts`, `sec_edgar.ts`,
  `anthropic.ts`. Each reports `costPerSearchUsd` and logs to `api_usage`.
- **3.2** `lib/research/gather.ts` — build the query set for one company (see `docs/06-PROMPTS.md`),
  run searches, dedupe hits by URL, return ≤20 hits with snippets.
- **3.3** `lib/anthropic/extract.ts` — one Claude call returning `SignalExtraction` JSON. Zod schema.
  On parse failure, retry once with the validation error appended to the prompt; then fail the job.
- **3.4** `lib/scoring/score.ts` — **pure function** `(extraction, weights) => Scores`. No I/O, no API.
  This is where every number in the app comes from.
- **3.5** Job queue: `POST /api/runs` enqueues one job per company and returns 202. The **worker**
  (`src/worker/index.ts`, run by `npm run worker`) loops: claim up to `WORKER_CONCURRENCY` jobs with
  `FOR UPDATE SKIP LOCKED`, process in parallel with `Promise.allSettled`, upsert results, sleep
  `WORKER_POLL_MS` when the queue is empty. All platform specifics go in `lib/jobs/driver.ts` so the
  loop stays portable. (This is the Render driver; a Vercel-cron driver is an optional alternate.)
- **3.6** `GET /api/runs/:id/progress`. Budget check before each claim; `halted_budget` if over.
- **3.7** `POST /api/runs/:id/rescore` — re-run 3.4 over stored signals. Zero API calls.

✅ Run the 79-company list end to end. Every `company_results` row has ≥1 `signals` row with a
resolvable `source_url`. Killing the worker mid-run and letting cron resume loses nothing. Two
concurrent workers never double-process a job.

**Tests (this is where they matter):**
- `score.test.ts` — golden fixtures. Feed the Erlanger signal set, assert `total = 69`,
  `fit = 27`, `trigger = 42`, `tier = tier_1`. Feed a fit-30/no-signal company, assert Tier 3
  (the guardrail). Feed `acquired_or_defunct`, assert `tier = defunct`, `total = 0`.
- `caveats.test.ts` — `enterprise_procurement` caps a 71 at Tier 2.
- Determinism: same input twice → identical output.

---

## Phase 4 — Results UI  *(~2 sessions)*

- **4.1** Score-anatomy bar component (fit segment + trigger segment + pulse dot). Reused everywhere.
- **4.2** Prospects table: columns, sorting, filter chips, tier distribution bar, streaming rows
  while a run is in progress.
- **4.3** List selector dropdown, populated from `lists.display_name`, with **VIEW ALL** pinned on top
  (queries `all_prospects`, adds the List column).
- **4.4** Company detail: hero, expanded anatomy with visible arithmetic, category bars, signal
  timeline, press cards, recommended play, contacts (unverified badge), caveats panel.
- **4.5** CSV export honoring active filters.

✅ Side-by-side with `design/company_assessment_app.html`, the Prospects table and Company Detail match the
prototype's layout, colors, and the score-anatomy bar (including the fresh-trigger pulse). Clicking a
row opens a detail page with real signals and clickable sources. VIEW ALL merges lists and dedupes by
domain.

---

## Phase 5 — Signals tab  *(~1–2 sessions)*

- **5.1** Signal library UI: grouped rows, plain-English copy, strength slider with the
  Ignored/Weak/Moderate/Strong/Decisive label, category chips, enable toggle, "fired for N of M."
- **5.2** Global controls: fit weights (warn if ≠ 30), recency curve, confidence, tier thresholds,
  category boost. Locked guardrail toggle with tooltip.
- **5.3** Live impact preview: client-side recompute, "12 companies change tier — 3 promoted, 9 demoted."
- **5.4** Save as named profile; `Apply to all lists` → rescore every latest run.

✅ Moving `new_facility_announced` from 48 → 10 visibly demotes the facility-driven Tier 1s in the
preview, and saving + applying updates the Prospects table without a single API call.

---

## Phase 6 — Settings & ship  *(~1 session)*

- **6.1** Analysis / Data sources / Budget / Retention tabs per `docs/04-UI-SPEC.md`.
- **6.2** Cost estimator on the upload confirm step (`docs/07-COSTS.md` math).
- **6.3** Spend dashboard: month-to-date by provider, 80% alert, halt-at-cap.
- **6.4** Deploy to **Render** following `docs/09-DEPLOY-RENDER.md`: push to GitHub → New → Blueprint
  (`render.yaml`) → creates `company-assessment-web` + `company-assessment-worker` + `company-assessment-db`. Set `ANTHROPIC_API_KEY` and the seed
  admin vars in the dashboard, run `db:seed` from the Shell, verify `/api/health`, add the custom
  domain, set `AUTH_URL`. Confirm the worker is on an **always-on** plan (never free).
  *(Alternate hosts — Vercel cron, Cloud Run Jobs — are in `docs/08-HOSTING.md`; only
  `lib/jobs/driver.ts` changes.)*
- **6.5** Retention job (weekly): a Render **Cron Job** service (or a scheduled tick inside the
  worker) that soft-deletes runs older than `settings.retention_days`.

✅ Deployed. A run from the hosted app completes. Budget cap actually halts a run.

---

## Phase 7 — Apollo enrichment *(Phase 2 of the product)*

- **7.1** `lib/enrichment/apollo.ts` — `POST /api/v1/people/match` with `(first_name, last_name,
  domain, title)`. Store `email`, `phone`, `source='apollo'`, `verified=true`, `enriched_at`.
- **7.2** `Reveal contact` button — one contact, one credit, one click. Confirm dialog shows the cost.
  **Never bulk-enrich.**
- **7.3** Credit balance in Settings; disable reveal at zero.
- **7.4** `DELETE /api/contacts/:id` for deletion requests; audit-log every reveal (who, when, which).

✅ Revealing a contact attaches an email. No code path enriches more than one contact per user action.

> **Do not build a LinkedIn scraper for this.** Automated collection from LinkedIn violates their
> terms. Apollo is the licensed path. Contacts found by public search stay `verified = false` until
> Apollo confirms them.

---

## Running it in GitHub Codespaces

The devcontainer gives you a full VM with no function timeout, so `npm run worker` behaves exactly as
it will in production. Put secrets in **Repo → Settings → Secrets → Codespaces**, point `DATABASE_URL`
at a Neon *dev branch*, and never commit `.env.local`. The codespace suspends when idle — don't start
a 100-company run and close the tab.

---

## Suggested first prompt to Claude Code

```
Read CLAUDE.md, then docs/00-PRD.md, docs/01-ARCHITECTURE.md, and docs/05-BUILD-PLAN.md.
Summarize back to me: the four opportunity categories, why scoring is done in code rather than by
the model, and how the Render worker drains the job queue. Then implement Phase 0 only, and stop.
```

If the summary is wrong, the docs are wrong — fix them before writing code.
