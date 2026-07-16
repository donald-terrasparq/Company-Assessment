# 00 — Product Requirements

## Problem

CTS Mobility sells four things. Finding companies that need them today means reading local business
journals, permit filings, press releases, and job boards one company at a time. It doesn't scale, and
the signal decays — a "new store opening" is worth a lot at 30 days and almost nothing at 12 months.

## What Company Assessment does

1. A user uploads a spreadsheet of companies (name + website, extra columns preserved).
2. They name the list. The system appends the upload date: `Pre-Intent Leads — 2026-07-09`.
3. A background run researches each company against public sources.
4. Each company gets a **fit score**, a **trigger score**, four **category scores**, a **tier**, and a
   set of **signals** — each with a source URL, date, recency multiplier, and confidence.
5. Users browse the ranked table, drill into any company, and see the signals, press, and contacts.
6. **View All** merges every company from every list into one board ranked by score.

## Users

| Role | Can |
|------|-----|
| `admin` | Everything, plus manage users, edit signal weights, set budget caps, view spend |
| `member` | Upload lists, run analyses, view all lists and results, export CSV |

Auth is username/password. **Self-registration is off by default** — an admin creates accounts or
issues an invite code. (Open registration on a tool that spends API credits per click is a way to get
a surprise bill. `settings.allow_open_registration` exists but ships `false`.)

## Functional requirements

### Upload
- Accept `.csv`, `.xlsx`. Max 5 MB. **Hard limit: 100 companies per list.**
  Enforced in three places: client-side on parse, server-side in `POST /api/lists` (reject with 422),
  and as a DB check. A file with more rows is rejected with a clear message — never silently truncated.
  Rationale: a 100-company run is ~20 min and single-digit dollars; it keeps runs predictable and
  bounds the blast radius of a bad weight profile or a runaway retry loop.
- Require a list name. Store `display_name = "{name} — {YYYY-MM-DD}"`.
- Column mapping UI: user maps their columns to `company_name` (required) and `website` (optional).
- Dedupe within a list on normalized website, else normalized name.
- Preserve unmapped columns in `companies.raw_row` (jsonb).

### Research & scoring
- **Stage 1 — identity.** Research starts by pinning down *which company this is*. If the row has no
  uploaded website, resolve the company's official domain from public sources first
  (`lib/research/identify.ts`), normalize it, and write it back to `companies.domain` with
  `domain_source = 'lookup'` (uploaded websites store `domain_source = 'upload'`). Signal research
  then reconfirms that the sources found actually match this name + domain; if identity can't be
  confirmed, the result carries an `identity_unconfirmed` caveat rather than silently scoring the
  wrong company.
- One background job per company, drained by the Render worker. Retries up to 3 times with backoff.
- Free-tier search providers in Phase 1 (see `docs/01-ARCHITECTURE.md`).
- Extract signals as structured JSON; score them with deterministic local code.
- Produce: `fit_score` (0–30), `trigger_score` (0–70), `total_score` (0–100), `tier`, and four
  category scores (`fwa_score`, `starlink_score`, `mobility_score`, `byod_score`, each 0–100).
- `primary_category` = highest-scoring category, used for the service tag in the table.
- Detect and flag: **defunct/acquired**, **enterprise/national procurement**, **foreign HQ**,
  **overseas growth**, **franchise/BYOD-sold**, **holding company** (portfolio = separate leads).
  These are `caveats[]` and they *cap* the tier — see the signal model.

### Browse
- **Prospects** — the ranked table for one selected list, or for View All.
- **Lists** — every list with name, date, count, status, run cost, actions (view / re-run / delete).
- **View All** — union of the latest run of every list, deduped by website, ranked by `total_score`.
- **Company detail** — score anatomy, signal timeline, press, recommended play, contacts, caveats.
  The header always shows the company name **and its domain** — whether it came from the lead list
  or from the stage-1 lookup — with a small badge indicating which (`uploaded` / `looked up`).
- **Signals** — the signal library with plain-English descriptions and editable weights.
- **Settings** — account, users, model, search provider, budget, retention, Apollo (Phase 2).

### Export
- CSV of the current view. Server-generated, respects filters.

## Non-goals (Phase 1)
- No CRM sync. No email sending. No paid data sources. No mobile app. No multi-tenant orgs
  (one org, many users). No real-time collaboration.

## Phase 2
- Apollo.io: for each identified contact, call Apollo's people-match endpoint with
  (name, company domain, title) and attach `email` / `phone` when Apollo returns a match with
  sufficient confidence. Store `contacts.source = 'apollo'`, `verified = true`.
- Reveal-on-demand only (each reveal costs an Apollo credit) — never bulk-enrich a whole list
  automatically.
- Compliance: contact data is business-contact data. Honor deletion requests
  (`DELETE /api/contacts/:id`), don't export to third parties, and note that CAN-SPAM/GDPR
  obligations sit with whoever sends the outreach.

## Success criteria
- A 100-company list completes in under 25 minutes and costs under $12.
- Uploading 101 companies fails with a clear error, not a truncated list.
- Every Tier 1 company has ≥1 signal dated within the last 5 months or in the forward window.
- Zero scores exist without a source-backed signal.
- Re-running the same list on the same day produces the same scores (deterministic math).
