# 04 — UI Specification

The approved prototype (**`design/company_assessment_app.html`** — open it in a browser) is the visual
source of truth for the Prospects and Company Detail screens. Match its layout, spacing, and
interaction, and pull the tokens below straight from it. This doc specifies all five screens plus the
design tokens. The prototype already renders **Prospects** and **Company Detail**; build **Lists**,
**Signals**, **Settings**, **VIEW ALL**, and the **upload modal** from this doc in the same visual
language.

## Design tokens

```
ink      #0F1B2D   rail background, primary text
steel    #3A5273   the "Fit" segment of every score bar
slate    #5B6675   secondary text
muted    #93A0B4   captions
paper    #F4F6F9   app background
card     #FFFFFF   surfaces
line     #E6E9EF   borders

tier_1   #0E8F6E   emerald      tier_2  #C0870F  amber      tier_3  #8A94A6  slate
FWA      #2563C9   blue         STARLINK #0EA5A4 teal
MOBILITY #7A3FF2   violet       BYOD     #E0682B orange
spark    #FF6B4A   coral — the live/fresh trigger pulse
```

Fonts: **Space Grotesk** (display), **Inter** (body), **JetBrains Mono** (all numerics — scores,
dates, points). Numbers must be tabular-figure aligned.

**The signature element** is the *score-anatomy bar*: every score renders as a steel `Fit` segment
plus a tier-colored `Trigger` segment on a 0–100 track, with a coral pulse dot when the trigger is
fresh (<30d or forward-looking). It appears on the table rows and, expanded with sub-bars, on the
detail screen. Do not replace it with a plain progress bar.

Left rail (74px, ink): brand → **Prospects** · **Lists** · **Signals** · **Settings** → avatar.

---

## 1. Prospects — `/prospects`

The main results table. Header carries a **list selector dropdown** whose options are every list by
`display_name` (e.g. `Pre-Intent Leads — 2026-07-09`), plus a pinned **VIEW ALL** option at the top
that switches the source to the `all_prospects` view and adds a "List" column.

- **Context strip**: filename, company count, last-run timestamp, signals scanned, `Re-run` button.
- **Tier distribution bar**: proportional segments for Tier 1/2/3/Defunct with counts.
- **Filter chips**: Tier 1/2/3 · FWA · Starlink · Mobility · BYOD · Fresh <30d · Hide caveats.
  Chips are additive; the count updates ("7 of 79 shown · sorted by score").
- **Table columns**: Rank · Company (monogram, name, HQ, size) · Industry · Score-anatomy ·
  Why now (trigger icon, one-line summary, recency pill, caveat flags) · Category tags · chevron.
- Sort by any column; default `total_score DESC`.
- Row click → company detail. `Export CSV` respects active filters.
- **Empty state**: "No lists yet — upload one to get started" with the upload CTA.
- **Running state**: if a run is in progress, show a progress bar polling
  `GET /api/runs/:id/progress` ("34 of 79 companies analyzed"), and stream rows in as they finish.

## 2. Company Detail — `/company/[resultId]`

- Header: monogram, name, HQ, industry, size, website, tier badge, big score + band.
  - The **domain is always shown next to the name** (linked, e.g. `erlanger.org`). If it came from
    the uploaded list (`domain_source = 'upload'`) no badge is needed; if research resolved it
    (`domain_source = 'lookup'`) show a small muted badge — `domain: looked up` — so the rep knows
    it's our inference, not the customer's data. If no domain could be resolved, show `no domain
    found` in muted text.
  - If the result carries the `identity_unconfirmed` caveat, an amber row in **Coverage & caveats**
    explains that the signals may belong to a similarly-named company.
- **Why now** hero (dark card): the trigger sentence, the dollar figure if any, category tags.
- **Score anatomy**: Fit sub-bars (industry/size/multi-location/geography) and Trigger with the
  arithmetic shown — `base 48 × recency 1.0 × confidence 0.88 ≈ 42`. Show the real numbers.
- **Category breakdown**: four horizontal bars (FWA / Starlink / Mobility / BYOD), primary one bold.
- **Signal timeline**: reverse-chronological, each with date, event type icon, paraphrased summary,
  source badge, confidence pill, and category tags. Every entry links to `source_url`.
- **Press & sources**: cards with paraphrased headline + ≤25-word excerpt + publication + date + link.
- **Recommended play**: numbered, model-generated, tied to the top signals.
- **Top contacts**: name, title, role rationale, LinkedIn link. Phase 1 shows an "unverified" badge
  and a disabled `Reveal email` button labeled "Apollo — Phase 2." Phase 2 enables it (one credit per
  reveal, never bulk).
- **Coverage & caveats**: green/amber rows explaining `enterprise_procurement`, `foreign_hq`, etc.

## 3. Lists — `/lists`

Table of every list:

| Column | Notes |
|---|---|
| Name | `display_name` — the user's name with the date appended |
| Uploaded by / on | user, timestamp |
| Companies | `79 / 100` — count against the cap, plus a "3 rows had unparseable URLs" warning chip if any |
| Last run | relative time, or a live progress bar if running |
| Tier breakdown | mini distribution bar (7 / 23 / 47 / 2) |
| Cost | `runs.cost_usd` for the latest run |
| Actions | View · Re-run · Re-score (free) · Export · Delete (soft) |

**Upload flow** (modal, 3 steps):

The modal header always displays the cap: **"Up to 100 companies per list."** The dropzone repeats it
in its idle copy (`Drop a .csv or .xlsx — max 100 companies`). After parsing, show a live counter —
`87 of 100 companies` — that turns amber at 90 and red past 100.

If the file exceeds 100 rows: block the Continue button and show
*"This file has 143 companies. The limit is 100 per list — split it into two lists."*
Offer a `Use first 100` secondary action, but never truncate silently or by default.

1. Drop `.csv`/`.xlsx` → parse client-side preview of first 10 rows; enforce the 100-row cap here first.
2. **Name the list** (required). Show a live preview: `My Q3 Targets — 2026-07-09`.
3. **Map columns** → `company_name` (required), `website` (optional). Warn on duplicates.
Then: "Analyze 87 companies · est. $4.60 · ~18 min" with a confirm button. Never start a paid run
without showing the estimate.

## 4. Signals — `/signals`

Two panes.

**Left: the signal library.** Grouped by the four categories plus Corporate and Negative. Each row:

- Signal name + **plain-English description** (from `docs/03-SIGNAL-MODEL.md` — the "Plain English"
  column is user-facing copy, not internal notes).
- A **strength slider** (0–60) bound to `weights.signals[key].base`, with a live text label:
  - 0 → `Ignored` · 1–20 → `Weak` · 21–35 → `Moderate` · 36–45 → `Strong` · 46+ → `Decisive`
- Category chips showing which of FWA/Starlink/Mobility/BYOD the signal feeds (editable, multi-select).
- An enable/disable toggle.
- A small sparkline: "fired for 23 of 79 companies."

**Right: the global controls.**

- **Fit weights**: four sliders summing to a displayed total (warn if ≠ 30).
- **Recency decay**: the six multipliers, rendered as an editable curve. Copy: *"How fast does a
  signal go stale? A new-store announcement from last week is worth 10× one from two years ago."*
- **Confidence**: three multipliers — primary / secondary / weak — with examples of each.
- **Tier thresholds**: two number inputs (Tier 1 min 63, Tier 2 min 38).
- **Category boost**: four multipliers. Copy: *"Pushing Starlink this quarter? Boost it. This changes
  ranking within a category, never the total score."*
- **Guardrail (locked, with explanation)**: "Fit alone can never produce a Tier 1. A company always
  needs at least one real, recent event." Show it as a disabled toggle with a tooltip — users should
  see the rule exists and understand why they can't turn it off.

**Live impact preview** (sticky footer): as sliders move, recompute client-side against the loaded
results and show *"12 companies change tier — 3 promoted, 9 demoted"* with a `Preview changes` link
that diffs the ranking. `Save profile` writes a new `signal_profiles` row; `Apply to all lists`
triggers `rescore` on every latest run (free, no API calls).

Profiles are named and switchable (`Default`, `Starlink push Q3`, …). Admins can edit; members can
preview but not save.

## 5. Settings — `/settings`

Tabbed.

**Account** — username, email, change password. Session list, sign out everywhere.

**Users** *(admin only)* — table of users, role, active toggle, `Invite user` (generates a one-time
code). `allow_open_registration` toggle, off by default, with the warning: *"Anyone with the URL
could create an account and spend API credits."*

**Analysis** —
- Model: `claude-sonnet-5` (Balanced, default) / `claude-opus-4-8` (High accuracy, ~3× cost).
  Show the per-run cost delta.
- Searches per company: 4–12 slider (default 8). Directly multiplies cost.
- Default signal profile.
- Concurrency: companies per worker tick (default 4).

**Data sources** —
- Search provider: `Brave (free tier)` · `Google CSE (100/day free)` · `Anthropic web search`.
  Each shows real cost: Anthropic is **$10 per 1,000 searches plus token costs** — label it, don't
  bury it. SEC EDGAR is always-on and free (shown as a locked, checked row).
- API key status per provider: `Configured` / `Missing` (never display the key, not even masked —
  just presence). Keys are set as Render service env vars, not in the UI.
- **Apollo.io** *(Phase 2)*: enable toggle, credit balance, "reveal on demand only" note.

**Budget** — monthly cap (default $100), current month spend with a progress bar broken out by
provider, "halt runs at cap" toggle (on), email alert at 80%.

**Data & retention** — retention days, export all data, delete a list permanently, delete contact
records on request.

---

## Accessibility & polish

- Every tier/category color is paired with a text label or icon — never color alone.
- `prefers-reduced-motion`: kill the coral pulse animation.
- Score bars get `role="img"` + `aria-label="Score 69 of 100: fit 27, trigger 42"`.
- Tables are real `<table>` markup with `<caption>`; the mockup's div-grid is for visual reference only.
- Loading states stream: show rows as jobs complete rather than blocking on the full run.
