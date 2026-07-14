# GETTING STARTED — from download to a running app

This is the one-page path: unzip → build with Claude Code → push to GitHub → deploy on Render →
invite users. Each step links to the deeper doc when you need it.

Estimated time: an afternoon to a first deploy, then Claude Code builds features over several sessions.

---

## What you have

```
Company-Assessment/
├── README.md                     start here
├── GETTING-STARTED.md            ← you are here
├── CLAUDE.md                     Claude Code's operating manual + hard rules
├── design/
│   ├── company_assessment_app.html     ★ the approved UI — open in a browser
│   └── README.md                 how to use it while building
├── docs/                         00–09: PRD, architecture, data + signal model,
│                                 UI spec, build plan, prompts, costs, hosting, Render deploy
├── db/schema.sql                 the database
├── render.yaml                   Render Blueprint (web + worker + Postgres)
├── package.json                  scripts Render + Claude Code rely on
├── lib/jobs/…  src/worker/…       the worker scaffolding
├── .devcontainer/                GitHub Codespaces
└── deploy/vercel-alternate/      optional; ignore unless you leave Render
```

---

## Step 0 — Look at the UI (2 minutes)

Open **`design/company_assessment_app.html`** in your browser. Toggle between **Prospect list** and
**Company detail** at the top. This is what you're building. Everything else serves this picture.

---

## Step 1 — Prerequisites (accounts + tools)

Accounts (all have free tiers to start):
- **GitHub** — code hosting → https://github.com
- **Render** — app hosting → https://render.com
- **Anthropic Console** — the API key that powers scoring → https://console.anthropic.com
- *(optional)* **Brave Search API** — free search tier → https://brave.com/search/api
- *(optional)* **Neon** — Postgres for local dev → https://neon.tech

Tools on your machine:
```bash
node --version      # need 20+
git --version
npm i -g @anthropic-ai/claude-code   # Claude Code CLI
```

Get your keys ready: an **Anthropic API key** (Console → API Keys) and, optionally, a **Brave key**.
You'll paste these into Render later — never into the code.

---

## Step 2 — Build the app with Claude Code

The download is a **spec-complete scaffold**, not a finished app — the docs, schema, UI prototype,
and worker skeleton are done; Claude Code writes the application code by following the build plan.

```bash
unzip company-assessment-starter.zip
cd Company-Assessment
claude
```

First prompt (also at the bottom of `docs/05-BUILD-PLAN.md`):

```
Read CLAUDE.md, then docs/00-PRD.md, docs/01-ARCHITECTURE.md, docs/05-BUILD-PLAN.md, and
docs/09-DEPLOY-RENDER.md. Open design/company_assessment_app.html and design/README.md so you know the
target UI. Summarize back to me: the four opportunity categories, why scoring is done in code rather
than by the model, how the Render worker drains the job queue, and what the UI should look like.
Then implement Phase 0 only, and stop.
```

If that summary is wrong, the docs are wrong — fix them before any code is written. Then continue
phase by phase ("implement Phase 1", etc.). Phases 0–6 are the working app; Phase 7 is Apollo (later).

Work locally as you go:
```bash
cp .env.example .env.local     # fill DATABASE_URL (a Neon dev branch), ANTHROPIC_API_KEY, AUTH_SECRET
npm install
npm run db:migrate && npm run db:seed
npm run dev                    # UI at http://localhost:3000
npm run worker                 # the scoring queue, in a second terminal
```

> Prefer the cloud? Open the repo in **GitHub Codespaces** (Step 3 first, then Code → Codespaces).
> The devcontainer runs everything; put keys in repo Codespaces secrets, not in `.env`.

---

## Step 3 — Put it on GitHub

```bash
git init
git add .
git commit -m "Company Assessment: initial scaffold"
git branch -M main
git remote add origin https://github.com/<you>/Company-Assessment.git
git push -u origin main
```

`.gitignore` already excludes `.env*` and `node_modules`, so no secrets go up. Confirm on GitHub that
you see the docs and `render.yaml` but **no `.env.local`**.

---

## Step 4 — Deploy to Render

Full walkthrough with screenshots-worth of detail: **`docs/09-DEPLOY-RENDER.md`**. The short version:

1. https://dashboard.render.com → **New → Blueprint** (not "Web Service" — the Blueprint creates all
   three services at once from `render.yaml`).
2. Connect GitHub, pick the `Company-Assessment` repo, **Apply**. Render provisions `company-assessment-db`, then builds `company-assessment-web`
   and `company-assessment-worker`.
3. Set the secrets Render won't generate (dashboard → each service → Environment):
   - both services: `ANTHROPIC_API_KEY`, `BRAVE_API_KEY`
   - `company-assessment-web` only: `SEED_ADMIN_USER`, `SEED_ADMIN_PASSWORD`, and `AUTH_URL`
     (`https://company-assessment-web.onrender.com` for now)
4. Seed once: `company-assessment-web` → **Shell** → `npm run db:seed`.
5. Visit `/api/health` → `{ ok: true }`, then log in with the seed admin and change the password.

**The one thing you must not do:** put `company-assessment-worker` on the free plan. Free services sleep when idle,
and the worker is idle between runs by design — a sleeping worker never processes an uploaded list.
Keep it on Starter (always-on). The blueprint already does this; don't override it down.

---

## Step 5 — Custom domain + invite users

(Also in `docs/09-DEPLOY-RENDER.md`.)

- **Domain:** `company-assessment-web` → Settings → Custom Domains → add `app.ctsmobility.com` → create the CNAME
  Render shows you at your DNS provider → Render issues TLS automatically → set `AUTH_URL` to the new
  domain and redeploy.
- **Users:** log in as admin → **Settings → Users → Invite user** → send each person their one-time
  link. They set their own password and land in as a `member` (upload lists, run analyses, view
  results). No Render account needed for end users — Render seats are only for whoever manages infra.

---

## Step 6 — Before anyone runs a real analysis

Every logged-in user spends **your** Anthropic credits when they run a list. Set the guardrails first:

1. **Settings → Budget** → set the monthly cap, "halt at cap" **on** (checked before every company).
2. **Anthropic Console** → set an independent spend alert as a backstop.
3. Upload the real `pre-intent.xlsx` (79 companies) and run it once end to end. Confirm: all 79 score,
   every company has ≥1 signal with a clickable source, the run finishes with no stuck job, and the
   worker logs show it picking up work within ~5s. That single run validates the whole pipeline on
   real infrastructure.

A full 100-company run is ~15–25 minutes and single-digit dollars (`docs/07-COSTS.md`).

---

## Where to look when…

| You want to… | Read |
|---|---|
| See the target UI | `design/company_assessment_app.html` + `design/README.md` |
| Understand scope & users | `docs/00-PRD.md` |
| Understand the queue / no-timeout worker | `docs/01-ARCHITECTURE.md` |
| Change the scoring / signal weights | `docs/03-SIGNAL-MODEL.md` |
| Build a specific screen | `docs/04-UI-SPEC.md` |
| Know what to build next | `docs/05-BUILD-PLAN.md` |
| Tune the research/scoring prompts | `docs/06-PROMPTS.md` |
| Estimate or cap cost | `docs/07-COSTS.md` |
| Compare hosts / leave Render | `docs/08-HOSTING.md` |
| Deploy on Render step by step | `docs/09-DEPLOY-RENDER.md` |
| Give Claude Code its rules | `CLAUDE.md` |

## Sanity checks

- [ ] `design/company_assessment_app.html` opens and both screens work
- [ ] `npm run dev` shows the shell; `npm run worker` logs a poll tick
- [ ] `npm run db:migrate` creates every table
- [ ] GitHub shows the repo with **no** `.env.local`
- [ ] Render: three services green, `/api/health` ok, worker on a **paid** plan
- [ ] Budget cap set before inviting anyone
- [ ] The real 79-company list runs end to end with sourced signals
