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

Nothing else. **Not** used and should NOT be granted to the key: Organization
Search/Enrichment (`organizations/*` — we research companies ourselves), Bulk
People Enrichment (`people/bulk_match` — bulk reveal is exactly what this design
avoids), and all CRM/sequence/task endpoints.

Phone numbers are delivered **asynchronously**: `people/match` with
`reveal_phone_number: true` requires a `webhook_url`; Apollo POSTs the number to
`/api/apollo/webhook` a minute or so later. The webhook URL carries an HMAC token
(derived from `AUTH_SECRET` + contact id), so only the callback for a contact we
actually requested can write, and only into that contact's phone field.

## Creating and integrating the API key

1. **Plan**: API access requires a paid Apollo plan (Basic or higher; email
   export credits are included per seat, mobile credits vary by plan).
2. **Create the key**: Apollo → Settings → **Integrations → API** → *Create new key*.
   Name it e.g. `company-assessment`. **Do not make it a master key** — under
   *API endpoint access*, enable only:
   - **People Search** — `POST /api/v1/mixed_people/search`
   - **People Enrichment** — `POST /api/v1/people/match`
3. **Set the env var**: Render dashboard → `company-assessment-web` →
   Environment → add `APOLLO_API_KEY` = the key. (Web service only — the worker
   never calls Apollo.) Save; Render redeploys.
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
