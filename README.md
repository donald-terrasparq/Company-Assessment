# Company Assessment — Prospect Signal Intelligence for CTS Mobility

Company Assessment ingests a list of companies, researches each one against public sources, and scores it on how
likely it is to need CTS Mobility's four service lines. Results are ranked, tiered, and drillable
down to individual signals, sources, and contacts.

**The four opportunity categories** (every company gets a score in each):

| Code | Category | What it means |
|------|----------|---------------|
| `FWA` | Fixed Wireless Access | New/moving sites, buildouts, temporary connectivity, branch & store openings |
| `STARLINK` | Starlink failover / backup | Uptime-critical, multi-site, POS-dependent, rural or low-redundancy locations |
| `MOBILITY` | Device programs | Apple / Samsung / Zebra handhelds, tablets, rugged scanners; hiring surges, frontline & field |
| `BYOD` | BYOD & remote workforce | Distributed/remote workforces, contractor and agent networks, MDM/managed-device demand |

## Status

Phase 1 (this build): upload → research (free search tiers) → score → rank → browse → drill in.
Phase 2 (later): Apollo.io enrichment to attach verified email/phone to identified contacts.

## See the target UI first

Open **`design/company_assessment_app.html`** in any browser before anything else — it's the interactive
prototype the app is built to match (two screens: the ranked prospect list and the Erlanger detail
view). `docs/04-UI-SPEC.md` is the written spec for it and the screens it doesn't yet cover.

## Quickstart

```bash
git clone <your-repo> Company-Assessment && cd Company-Assessment
cp .env.example .env.local     # fill in the values
npm install
npm run db:migrate             # applies db/schema.sql
npm run db:seed                # creates admin user + default signal profile
npm run dev                    # http://localhost:3000  (UI + API)
npm run worker                 # the analysis queue worker (same loop that runs on Render)
```

To deploy: push to GitHub, then follow `docs/09-DEPLOY-RENDER.md` (Render Blueprint).

New here? Read **`GETTING-STARTED.md`** — it walks the whole path start to finish.

Then hand the repo to Claude Code:

```bash
claude
> Read CLAUDE.md and docs/05-BUILD-PLAN.md, then implement Phase 0.
```

## Docs

| File | What's in it |
|------|--------------|
| `GETTING-STARTED.md` | **End-to-end: download → Claude Code → GitHub → Render → invite users** |
| `CLAUDE.md` | Operating manual + hard rules for Claude Code. Read first. |
| `docs/00-PRD.md` | Product requirements, users, scope |
| `docs/01-ARCHITECTURE.md` | Stack, data flow, the timeout problem and its solution |
| `docs/02-DATA-MODEL.md` | Schema, entities, storage |
| `docs/03-SIGNAL-MODEL.md` | Scoring math, signal taxonomy, default weights |
| `design/company_assessment_app.html` | **The approved UI prototype — open in a browser. Visual source of truth.** |
| `docs/04-UI-SPEC.md` | Every screen: Prospects, Lists, Signals, Settings, Detail, View All |
| `docs/05-BUILD-PLAN.md` | Phased tickets with acceptance criteria |
| `docs/06-PROMPTS.md` | The research + scoring prompts sent to the Claude API |
| `docs/07-COSTS.md` | What a run actually costs, and how to cap it |
| `docs/08-HOSTING.md` | Host comparison — why Render, and the alternatives |
| `docs/09-DEPLOY-RENDER.md` | **Step-by-step Render deploy: GitHub → domain → user invites** |
| `render.yaml` | Render Blueprint (web + worker + Postgres) |
| `deploy/vercel-alternate/` | Optional Vercel path, if you ever want the UI on Vercel's edge |

## Limits

**Lists are capped at 100 companies.** Enforced client-side, at the API, and in the database.
A 100-company run is ~20 minutes and single-digit dollars — the cap is what keeps that true.

## Cost reality check

A full 100-company run using the Anthropic web search tool is roughly **$4–12** (see `docs/07-COSTS.md`).
The "free" search path uses free API tiers instead and costs only tokens. Neither is zero.

## Hosting — Render

Company Assessment deploys to **Render** as a Blueprint (`render.yaml`): a web service (Next.js UI + API), a
background worker (the analysis queue, no timeout), and managed Postgres. Push to GitHub, point
Render at the repo via **New → Blueprint**, set `ANTHROPIC_API_KEY`, and you're live. Full steps —
including custom domain and inviting users — are in **`docs/09-DEPLOY-RENDER.md`**.

The code is host-agnostic (all platform logic sits in `lib/jobs/driver.ts`), so Vercel + cron or
Cloud Run Jobs remain drop-in alternatives if you ever want them — see `docs/08-HOSTING.md`.
