# 02 — Data Model

Full DDL: `db/schema.sql`. This doc explains the *why*.

## Entity map

```
users ──uploads──> lists ──has many──> companies
                     │
                     └──has many──> runs ──has many──> jobs   (one per company)
                                      │
                                      └──produces──> company_results
                                                        ├── signals   (evidence, with source_url)
                                                        └── contacts  (Phase 2: + email/phone)
signal_profiles ──used by──> runs
api_usage ──rolls up to──> runs.cost_usd
```

## Key decisions

**`lists` vs `runs` are separate.** A list is the *input* (79 companies). A run is one *analysis pass*
over it. Re-running a list next quarter creates a new run and leaves the old scores intact, so you
can see how a company's signals changed over time. The Lists tab shows the latest run per list; the
`latest_runs` view does that work.

**`company_results` has `UNIQUE (run_id, company_id)`.** Job retries upsert. Without this, a flaky
network call produces two rows and a company appears twice in the table.

**`signals.source_url` is `NOT NULL`.** This is the schema enforcing rule 5 in `CLAUDE.md`. If the
model can't produce a source, the signal doesn't exist, and if there are no signals the trigger score
is 0. You cannot get a Tier 1 out of this database without a URL someone can click.

**`signals.summary` is paraphrased.** Never store more than a 25-word verbatim excerpt from a source.
Store URL + publication + date + your own words. The detail screen renders the paraphrase and links
out.

**Category scores are stored, not computed on read.** Four integer columns beat a jsonb blob for
`ORDER BY fwa_score DESC` and for the filter chips.

**`caveats` is jsonb array of enum strings.** Small, queryable with `@>`, and lets us add caveat types
without a migration.

**`raw_row` preserves the user's original spreadsheet columns.** They uploaded a column called
"Account Owner"; we don't know what it means, but we shouldn't destroy it.

## Domain normalization

`companies.domain` = website lowercased, scheme stripped, leading `www.` stripped, trailing path/slash
removed. `https://WWW.Example.com/about` → `example.com`.

This does the deduping in **View All** (`all_prospects` view). It also catches the case from the
source data where the same company appears in two lists under slightly different names.

Guard: a bad URL in the source file (typos are common — `mcirocenter.com`) shouldn't crash the parse.
Store the raw string in `website`, set `domain` to `NULL` if it doesn't parse, and fall back to
name-based dedupe. Surface these on the Lists screen as "3 rows had unparseable URLs."

## View All

`all_prospects` unions the latest complete run of every non-deleted list, dedupes on
`COALESCE(domain, lower(name))`, and keeps the highest-scoring row per company. Ranked by
`total_score DESC`. The `list_name` column tells the user which list a given row came from.

## Retention

`settings.retention_days` (default 365). A weekly Render Cron Job soft-deletes runs older than that, keeping
`lists` and `companies` (cheap) and dropping `signals` (bulky). Contacts with `source='apollo'` are
deleted on request per `docs/00-PRD.md`.
