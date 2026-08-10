# 00 — Product Requirements

## Problem

CellSite Solutions (www.cellsitesolutions.com) manufactures prefabricated telecom equipment
buildings — remanufactured concrete shelters and the DataComm Pro line of reinforced lightweight
modular buildings — sold into five categories: fiber huts & telecom shelters, wireless tower sites,
modular data centers & edge, E911/public safety, and other shelter verticals (oil & gas, defense,
utilities). Finding the
operators, co-ops, municipalities, and industrial buyers who need them today means reading state
broadband award lists, grant announcements, permit filings, and trade press one organization at a
time. It doesn't scale, and the signal decays — a "BEAD award announced" is worth a lot at 30 days
and almost nothing at 12 months.

## What Company Assessment does

1. A user uploads a spreadsheet of companies (name + website, extra columns preserved).
2. They name the list. The system appends the upload date: `Fiber Operators — Midwest — 2026-07-09`.
3. A background run researches each company against public sources.
4. Each company gets a **fit score**, a **trigger score**, five **category scores**, a **tier**, and a
   set of **signals** — each with a source URL, date, recency multiplier, and confidence.
5. Users browse the ranked table, drill into any company, and see the signals, press, and contacts.
6. **View All** merges every company from every list into one board ranked by score.

## Users

| Role | Can |
|------|-----|
| `admin` | Everything — sees **all tabs** (Prospects, Lists, Signals, Leads, Settings); manages users, edits signal weights, sets budget caps, views spend, triages leads |
| `member` | Sees **only the Prospects, Lists, and Signals tabs** (for now). Upload lists, run analyses, view all lists and results, export CSV |

Tab visibility is enforced server-side (route middleware returns 403/redirect), not just hidden in
the nav. The Users table in Settings shows each user's **date of last login**
(`users.last_login_at`, stamped on every successful sign-in).

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
- One background job per company, drained by the Render worker. Retries up to 3 times with backoff.
- Free-tier search providers in Phase 1 (see `docs/01-ARCHITECTURE.md`).
- Extract signals as structured JSON; score them with deterministic local code.
- Produce: `fit_score` (0–30), `trigger_score` (0–70), `total_score` (0–100), `tier`, and five
  category scores (`fiber_score`, `tower_score`, `datacomm_score`, `e911_score`, `other_score`,
  each 0–100).
- `primary_category` = highest-scoring category, used for the category tag in the table.
- Detect and flag: **defunct/acquired**, **enterprise/national procurement**, **foreign HQ**,
  **overseas growth**, **local-only builds**, **self-perform (builds its own shelters)**,
  **holding company** (portfolio = separate leads).
  These are `caveats[]` and they *cap* the tier — see the signal model.

### Browse
- **Prospects** — the ranked table for one selected list, or for View All.
- **Lists** — every list with name, date, count, status, run cost, actions (view / re-run / delete).
- **View All** — union of the latest run of every list, deduped by website, ranked by `total_score`.
- **Company detail** — score anatomy, signal timeline, press, recommended play, contacts, caveats.
- **Signals** — the signal library with plain-English descriptions and editable weights.
- **Leads** *(admin)* — inbound contact-us / ebook / RB2B leads with triage and company links.
- **Settings** — account, users (incl. last login), model, search provider, budget, retention,
  Apollo (Phase 2).

### Leads (inbound) — admin-only tab

Inbound interest arrives from three sources, and all of it is **preserved with its timestamp** —
triage re-buckets a lead, it never deletes one:

1. **eBook lead forms** — several different ebook download forms on the website. Each submission
   records which ebook (`ebook_slug`).
2. **CONTACT US page** — same pipeline, plus the visitor's **notes/message content is preserved
   verbatim** as a field (`leads.message`).
3. **RB2B** — website visitor-identification data (person/company identified from site visits).
   Every visit is kept as its own timestamped event.

Contact-us and ebook submissions **arrive in a mailbox** as email forwarded from the current
website; the system ingests that mailbox and parses each mail into a lead (raw email kept for
audit/re-parse). RB2B arrives via its webhook/export.

**Company enrichment:** when a lead carries a company name (RB2B) and/or a domain (form field or a
work-email domain), the tool resolves it to a company and links the lead to the **enriched detailed
company view** — the same drill-down a Prospect row gets. If the company has never been analyzed, an
admin can trigger a single-company analysis from the lead row (it lands in a reserved "Inbound
Leads" list, subject to the same 100-cap and budget rules).

**Triage:** each source has its own view, and within it a lead is either active (`new`/`qualified`)
or bucketed as **individual** (not a business), **marketing request** (vendor pitch via the
contact form), or **low potential** (a business, but weak fit for CellSite Solutions). Bucketed
leads stay stored and visible under their bucket.

### Export
- CSV of the current view. Server-generated, respects filters.

## Non-goals (Phase 1)
- No CRM sync. No *outbound* email sending (the Leads mailbox is inbound-only). No paid data
  sources. No mobile app. No multi-tenant orgs (one org, many users). No real-time collaboration.

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
