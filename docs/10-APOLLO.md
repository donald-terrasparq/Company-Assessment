# Phase 7 — Apollo.io contact enrichment

Finds **target best contacts** per company and reveals **email / direct phone on
demand, per selected contact** — never in bulk. Complies with hard rule 2: Apollo's
API is the sanctioned path; we never scrape LinkedIn.

## Targeting rules (enforced server-side in `lib/apollo/targeting.ts`)

| Company size | Who is a "best contact" |
|---|---|
| Revenue < $20M (or < 100 employees when revenue unknown) | Owner / founder / CEO allowed — they are the buyer |
| $20M – $500M revenue (100–999 employees) | C-level OK (CIO, CTO, COO…) but **never the CEO** |
| > $500M revenue (1,000+ employees) | **No C-level at all** — VP / Head / Director / Manager of IT |

IT-first titles are prioritized (CIO, CTO, IT Director, Infrastructure, Network,
Telecom). The gate is applied to whatever Apollo's search returns, so a fuzzy
match can never surface a CEO on a $2B account. Both are unknown → mid-tier
rules (no CEO), the safe default.

## Exactly which Apollo endpoints are used

| Endpoint | When | Cost |
|---|---|---|
| `POST /api/v1/mixed_people/search` (**People Search**) | "Find best contacts" button | No export credits — returns names/titles/LinkedIn only, never emails |
| `POST /api/v1/people/match` (**People Enrichment**) | "Reveal email" / "Get phone #" on ONE selected contact | 1 export credit per email; 1 mobile credit per phone |
| `GET /api/v1/organizations/enrich` (**Organization Enrichment**) | Every analysis run (worker), per company with a domain | No export credits |
| `POST /api/v1/news_articles/search` (**News Search**) | Every analysis run, when org enrichment returned an id | No export credits |

Organization enrichment fills firmographics the research pass missed (employee
count, annual revenue, retail locations — these backstop the ENT/MM/SMB segment
badge), plus funding history and detected tech stack, all fed to the extraction
prompt as reference facts. News articles become citable candidate sources;
items without a resolvable URL are dropped (hard rule 3), and the usual
Zod validation + citation guard still applies before anything is stored.

Nothing else. **Not** used and should NOT be granted to the key: Bulk People
Enrichment (`people/bulk_match` — bulk reveal is exactly what this design
avoids), Organization Search, and all CRM/sequence/task endpoints.

Phone numbers are delivered **asynchronously**: `people/match` with
`reveal_phone_number: true` requires a `webhook_url`; Apollo POSTs the number to
`/api/apollo/webhook` a minute or so later. The webhook URL carries an HMAC token
(derived from `AUTH_SECRET` + contact id), so only the callback for a contact we
actually requested can write, and only into that contact's phone field.

## Creating and integrating the API key

1. **Plan**: API access requires a paid Apollo plan (Basic or higher; email
   export credits are included per seat, mobile credits vary by plan).
2. **Create the key**: Apollo → Settings → **Integrations → API** → *Create new key*.
   Name it e.g. `company-assessment`. Under *API endpoint access*, enable:
   - **People Search** — `POST /api/v1/mixed_people/search`
   - **People Enrichment** — `POST /api/v1/people/match`
   - **Organization Enrichment** — `GET /api/v1/organizations/enrich`
   - **News Search** — `POST /api/v1/news_articles/search`

   **If searches still return 403 with those enabled, set the key as a
   master key.** Apollo requires master keys for its *search* endpoints
   (People Search, News Search) on most plans — scoped keys reliably cover
   only the enrichment endpoints. A master key is safe here because the app
   itself only ever calls the four endpoints above, the key lives in a
   server-side env var, and reveals are single-contact user actions.

   **Plan note**: Professional and higher plans include API access — no
   separate API purchase is needed for these endpoints; they draw on the
   plan's rate limits and credit allowances.
3. **Set the env var**: Render dashboard → add `APOLLO` = the key
   (`APOLLO_API_KEY` also accepted) on **both** services: `company-assessment-web`
   (contact search + reveals) and `company-assessment-worker` (org enrichment +
   news during runs). Save; Render redeploys.
4. **Run the migration**: automatic — the deploy's `preDeployCommand` applies
   `0007_apollo.sql` (adds `contacts.apollo_person_id`, `contacts.phone_requested_at`).
5. **Enable the feature**: sign in as admin → Settings → **Data sources** →
   check *Enable Apollo contact enrichment* → Save. (`settings.apollo_enabled`
   is re-checked server-side on every Apollo route.)
6. **Custom domain note**: the phone webhook URL is derived from the request
   host (or `APP_URL` env var if set). If Apollo's callbacks must hit a specific
   domain, set `APP_URL=https://app.yourdomain.com` on the web service.

## Flow summary

1. Detail page → **Find best contacts — Apollo** → People Search with the
   company domain + band-appropriate seniorities → top 5 ranked IT-first
   contacts stored (`source='apollo'`, `verified=true`, no email/phone), deduped
   against research-found contacts by name.
2. User **selects** a contact → *Reveal email* (work email only,
   `reveal_personal_emails: false`) and *Get phone #* options appear.
3. Email: synchronous — stored on the contact, shown with copy/mailto.
4. Phone: request marks the contact pending; the webhook stores the number;
   the UI shows "Phone requested — refresh".
5. Every call is logged to `api_usage` (`provider='apollo'`) for the Budget
   tab's spend dashboard (credits are plan allowance, so `cost_usd` is 0).
