# 06 — Prompts

## Query set per company (`lib/research/gather.ts`)

Build from the company name + domain. Default 9 searches (Settings-tunable, 4–12).
Always include the current year — the model's queries otherwise skew stale.
The search themes: **fiber expansion**, **BEAD & other grant financing**, **wireless tower builds**,
**data center / edge growth**, **E911 / public-safety modernization**, and **oil & gas / defense /
other industries** that deploy modular fiber hut & telecom shelter buildings.

```
1. "{name}" fiber build OR "fiber-to-the-home" OR broadband expansion {year}
2. "{name}" BEAD OR ReConnect OR "broadband grant" OR "state broadband" award {year}
3. "{name}" cell tower OR "new towers" OR 5G OR "wireless infrastructure" {year}
4. "{name}" data center OR "edge computing" OR modular deployment {year}
5. "{name}" E911 OR NG911 OR PSAP OR "public safety" upgrade {year}
6. "{name}" acquisition OR merger OR funding OR investment {year}
7. "{name}" CTO OR "VP of network" OR "outside plant" OR "network engineering"
8. "{name}" pipeline OR SCADA OR defense OR "remote site" communications {year}
9. site:sec.gov "{name}"                       ← free, high-confidence
```

Plus, always and free: SEC EDGAR full-text search on the legal entity name.

Drop hits older than 18 months before sending to the model — they cost tokens and score ~0.1 anyway.

## Extraction call (`lib/anthropic/extract.ts`)

One call per company. Model from `settings.model`. `max_tokens: 4096`.
If `search_provider = 'anthropic'`, pass the web search tool and skip step 1 entirely:

```ts
tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 9 }]
```

Otherwise pass the pre-fetched hits as context.

### System prompt

```
You are a B2B signal analyst for CellSite Solutions (www.cellsitesolutions.com), a telecommunications
infrastructure manufacturer. It builds prefabricated telecom equipment buildings: remanufactured
concrete shelters (fast, economical, proven) and DataComm Pro — a new line of reinforced, lightweight,
often larger modular buildings. It sells into five categories:

  FIBER     — Fiber Huts & Telecom Shelters: hardened buildings housing OLTs, splice points, and hub
              electronics on fiber routes. SOLD WHEN a fiber build is announced or funded (BEAD,
              ReConnect, state broadband grants), when a rural utility or electric co-op launches or
              expands a fiber ISP, or when a mid-tier operator deploys across states/regions rather
              than a single city. Shelters are specced during outside-plant engineering, before
              construction starts — either remanufactured concrete or DataComm Pro, sized per site.
  TOWER     — Wireless Tower Sites: a fiber hut / telecom shelter often sits at the base of a
              wireless tower housing radios, backhaul, and power. SOLD WHEN tower companies,
              carriers, or neutral hosts announce new tower builds, coverage expansion, 5G infill,
              or colocation/upgrade projects that add ground equipment.
  DATACOMM  — Modular Data Centers & Edge: data center and edge operators using modular buildings
              instead of stick-built shells. SOLD WHEN an operator announces capacity expansion, new
              markets, micro/edge rollouts, or a modular deployment strategy where DataComm Pro's
              larger reinforced buildings fit.
  E911      — E911 / Public Safety: secure buildings that house the servers and ISP equipment behind
              E911/NG911 service. SOLD WHEN a city, county, or municipality announces an NG911
              migration, a PSAP consolidation or hardening project, or wins emergency-communications
              funding.
  OTHER     — Other shelter verticals: oil & gas, defense, utilities, transportation, and other
              industries deploying telecom shelters/fiber huts at remote sites. SOLD WHEN a pipeline
              SCADA/comms buildout, defense or base-infrastructure project, grid-modernization
              program, or other remote-communications deployment is announced.

Your job is to EXTRACT AND CLASSIFY evidence. You do not compute scores. You do not rank.

Rules:
- Every signal MUST have a working source_url from the provided sources. No URL, no signal. Never
  invent, guess, or reconstruct a URL.
- Never invent a person, a date, a dollar figure, or a quote.
- `summary` must be YOUR OWN WORDS. Never copy more than 25 consecutive words from a source.
- If you find no qualifying signals, return an empty signals array. That is a valid, useful answer.
  An empty array is far better than a fabricated one.
- Prefer forward-looking events (announced, funded, entering construction, opening next year) —
  mark is_forward.
- Classify source_class honestly: primary = company PR, state broadband office award list, NTIA/USDA
  announcement, SEC filing, permit, government procurement notice. secondary = broadband/fiber trade
  press, business journal, wire. weak = blog, aggregator, job-board inference.
- Flag caveats when they apply. They protect the sales rep from wasting a week.

Return ONLY valid JSON matching the schema. No markdown fences, no preamble.
```

### User message

```
Company: {name}
Website: {website}
Today's date: {YYYY-MM-DD}

Allowed signal types (use these exact keys):
{taxonomy keys + one-line descriptions from docs/03-SIGNAL-MODEL.md}

Allowed caveats:
defunct, enterprise_procurement, foreign_hq, overseas_growth, holding_company,
local_only, self_perform, public_procurement

Sources:
{numbered list of {url, title, published_date, snippet}}

Return JSON:
{
  "industry": string,
  "hq": string,
  "size_label": string,
  "employee_estimate": number | null,
  "location_count": number | null,
  "fit": {
    "industry": 0-10, "size": 0-8, "multi_location": 0-7, "geography": 0-5,
    "rationale": string
  },
  "signals": [{
    "event_type": string,          // must be a key from the taxonomy
    "categories": ["FIBER"|"TOWER"|"DATACOMM"|"E911"|"OTHER"],
    "title": string,
    "summary": string,             // paraphrased, <= 40 words
    "event_date": "YYYY-MM-DD" | null,
    "is_forward": boolean,
    "source_url": string,          // must appear in Sources above
    "source_name": string,
    "source_class": "primary"|"secondary"|"weak"
  }],
  "caveats": [string],
  "why_now": string,               // one sentence, or "" if no signals
  "recommended_play": string,      // 2-4 sentences, tied to the top signals
  "contacts": [{
    "name": string,
    "title": string,
    "role_rationale": string,
    "linkedin_url": string | null,
    "source_url": string           // where you found this person named
  }]
}
```

## Guarding the output

```ts
const SignalExtraction = z.object({ /* mirror of the above */ })
```

Post-parse validation, in `lib/anthropic/extract.ts` — enforce what the prompt asks for rather than
trusting it:

1. **Drop any signal whose `source_url` is not in the sources we supplied.** This is the single most
   important line of code in the app. A model that invents a citation will do it convincingly.
2. Drop any signal whose `event_type` isn't in the taxonomy.
3. Drop contacts with no `source_url`. Mark the rest `verified = false`.
4. Clamp fit sub-scores to their maxima.
5. If `signals` is empty → `trigger_score = 0`, tier is 2 or 3 by fit alone. This is correct behavior,
   not an error.

Then hand `signals` to `lib/scoring/score.ts` and let deterministic code produce every number.

## Why the model doesn't score

Two reasons. **Reproducibility:** the same evidence must always yield the same number, or users can't
trust the ranking and can't tune weights. **Cost:** re-scoring after a weight change is then free —
you re-read stored signals instead of re-researching 79 companies.

The model is good at "this is a BEAD grant award from a primary source dated May 2026."
It is unreliable at "46 × 1.0 × 0.95 summed with three other terms." Use each for what it's good at.
