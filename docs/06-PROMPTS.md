# 06 — Prompts

## Stage 1 — identity resolution (`lib/research/identify.ts`)

Runs **only** when `companies.domain IS NULL` (no website uploaded, or it didn't parse). One or two
searches — `"{name}" official website` plus `"{name}" {hq_or_industry_hint}` if the raw row has one —
then a small, cheap model call over the hits:

```
Which of these results is the official website of the company named "{name}"?
Return JSON: { "domain": string | null, "evidence_url": string | null }
- domain must be the bare registrable domain of the OFFICIAL site (no scheme, no www, no path).
- evidence_url must be one of the provided result URLs.
- If none of the results is clearly this company's official site, return domain: null.
  Never construct a domain from the company name.
```

Zod-parse, normalize via `lib/normalize/domain.ts`, write back `companies.domain` with
`domain_source = 'lookup'`. `null` is a valid answer — research then proceeds on name alone and the
extraction is more likely to flag `identity_unconfirmed`.

## Query set per company (`lib/research/gather.ts`)

Build from the company name + domain. Default 10 searches (Settings-tunable, 4–12).
Always include the current year — the model's queries otherwise skew stale.

```
 1. "{name}" new facility OR headquarters OR expansion {year}
 2. "{name}" new store OR branch OR location opening {year}
 3. "{name}" number of stores OR locations OR branches   ← footprint; prevents chains reading as single-site
 4. "{name}" "locations" about company overview          ← footprint
 5. "{name}" hiring OR jobs OR "new employees" {year}
 6. "{name}" acquisition OR merger OR funding {year}
 7. "{name}" CIO OR CTO OR "VP of IT" OR "head of infrastructure"
 8. "{name}" outage OR downtime OR "business continuity"
 9. "{name}" remote work OR BYOD OR field technicians OR warehouse
10. site:sec.gov "{name}"                       ← free, high-confidence
```

Plus two public-LinkedIn queries via the search index (SERP snippets only — the app never
crawls linkedin.com; hard rule 2). Wireless buying sits with IT, so they target the IT org:

```
site:linkedin.com/in "{name}" CIO OR CTO OR "VP IT" OR "IT Director" OR "Director of Information Technology"
site:linkedin.com/in "{name}" "IT Infrastructure" OR "network" OR "telecom" OR "telecommunications" manager OR director
```

Plus, always and free: SEC EDGAR full-text search on the legal entity name.

## Free enrichment layer (`lib/research/enrich.ts`)

Alongside search, every company gets a $0 enrichment pass — each connector independent,
time-bounded (8s), and failure-tolerant:

| Source | Contributes |
|---|---|
| SEC EDGAR XBRL company facts (data.sec.gov) | Employee count + revenue from filings (public cos) |
| Wikidata | Employees, founding year, **official website** (catches uploaded-domain typos) |
| GDELT DOC 2.0 | Recent news articles (citable sources) |
| Google News RSS | Recent headlines (citable sources; unofficial, fragile-tolerant) |
| Greenhouse / Lever public boards | Live job-posting counts (citable hiring evidence) |
| USAspending.gov | Federal contract awards (citable; disable with `ENRICH_USASPENDING=0`) |

Registry facts go into the prompt as a "Reference data" block — context for fit/size/
footprint/identity, **not** signal evidence. News/jobs/awards join the Sources list and are
citable. A Wikidata official website also fills a missing domain (`domain_source='lookup'`).

Drop hits older than 18 months before sending to the model — they cost tokens and score ~0.1 anyway.

## Extraction call (`lib/anthropic/extract.ts`)

One call per company. Model from `settings.model`. `max_tokens: 4096`.
If `search_provider = 'anthropic'`, pass the web search tool and skip step 1 entirely:

```ts
tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }]
```

Otherwise pass the pre-fetched hits as context.

### System prompt

```
You are a B2B signal analyst for CTS Mobility, a Verizon partner that sells four things:

  FWA       — Fixed Wireless Access: primary or backup internet over cellular. Sold when a company
              opens, moves into, or builds a physical site, or needs connectivity fast.
  STARLINK  — Satellite failover for uptime-critical or low-redundancy sites.
  MOBILITY  — Managed devices: Apple/Samsung phones and tablets, Zebra rugged scanners. Sold when a
              company hires frontline staff, runs field/warehouse/clinical operations, or refreshes devices.
  BYOD      — Managing personal devices for distributed, remote, contractor, or agent workforces.

Your job is to EXTRACT AND CLASSIFY evidence. You do not compute scores. You do not rank.

Rules:
- Every signal MUST have a working source_url from the provided sources. No URL, no signal. Never
  invent, guess, or reconstruct a URL.
- Never invent a person, a date, a dollar figure, or a quote.
- `summary` must be YOUR OWN WORDS. Never copy more than 25 consecutive words from a source.
- If you find no qualifying signals, return an empty signals array. That is a valid, useful answer.
  An empty array is far better than a fabricated one.
- Prefer forward-looking events (announced, under construction, opening next year) — mark is_forward.
- Classify source_class honestly: primary = company PR, SEC filing, permit, government announcement.
  secondary = business journal, trade press, wire. weak = blog, aggregator, job-board inference.
- Flag caveats when they apply. They protect the sales rep from wasting a week.

Return ONLY valid JSON matching the schema. No markdown fences, no preamble.
```

### User message

```
Company: {name}
Website: {domain or "unknown"}   ({domain_source: "provided by the customer list" | "resolved by prior research" | "not found"})
Today's date: {YYYY-MM-DD}

Identity check: before extracting signals, confirm the sources below are about THIS company —
the name and (if present) the domain must match. If you cannot confirm it (ambiguous name, sources
about a similarly-named company), include "identity_unconfirmed" in caveats and only extract
signals you are confident belong to this exact company.

Allowed signal types (use these exact keys):
{taxonomy keys + one-line descriptions from docs/03-SIGNAL-MODEL.md}

Allowed caveats:
defunct, enterprise_procurement, foreign_hq, overseas_growth, holding_company,
franchise_model, single_site, public_procurement, identity_unconfirmed

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
    "categories": ["FWA"|"STARLINK"|"MOBILITY"|"BYOD"],
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
  "recommended_play": [string],    // 3-5 concise steps: bold imperative lead-in + one support sentence
  "coverage": [{ "tone": "good"|"warn", "note": string }],  // 2-4 sellability observations from the sources
  "contacts": [{                   // up to 4, covering different buying roles; only people named in sources
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

The model is good at "this is a new-facility announcement from a primary source dated May 2026."
It is unreliable at "48 × 1.0 × 0.88 summed with three other terms." Use each for what it's good at.
