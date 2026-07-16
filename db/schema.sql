-- Company Assessment — Postgres schema (Render Managed Postgres in prod; Neon dev branch locally)
-- Apply with: npm run db:migrate

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────── auth & config ───────────────────────────

CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username       TEXT UNIQUE NOT NULL,
  email          TEXT UNIQUE,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- single-row org settings (id = 1)
CREATE TABLE settings (
  id                       INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  model                    TEXT NOT NULL DEFAULT 'claude-sonnet-5',
  high_accuracy_model      TEXT NOT NULL DEFAULT 'claude-opus-4-8',
  search_provider          TEXT NOT NULL DEFAULT 'brave',
  monthly_budget_usd       NUMERIC(10,2) NOT NULL DEFAULT 100.00,
  allow_open_registration  BOOLEAN NOT NULL DEFAULT FALSE,
  retention_days           INT NOT NULL DEFAULT 365,
  apollo_enabled           BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- editable weighting profiles; `weights` shape documented in docs/03-SIGNAL-MODEL.md
CREATE TABLE signal_profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  weights     JSONB NOT NULL,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_default_profile ON signal_profiles (is_default) WHERE is_default;

-- ─────────────────────────── lists & companies ───────────────────────────

CREATE TABLE lists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,                 -- user-supplied
  display_name    TEXT NOT NULL,                 -- "{name} — {YYYY-MM-DD}"
  uploaded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  source_filename TEXT,
  blob_url        TEXT,                          -- raw file (Render disk or S3-compatible)
  company_count   INT NOT NULL DEFAULT 0 CHECK (company_count <= 100),  -- hard cap: 100 per list
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE companies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id      UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  website      TEXT,
  domain       TEXT,                             -- normalized: lowercase, no scheme/www
  -- where the domain came from: mapped from the uploaded file, or resolved by
  -- research stage 1 (lib/research/identify.ts) when the list had no website
  domain_source TEXT CHECK (domain_source IN ('upload','lookup')),
  raw_row      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX companies_list_idx ON companies(list_id);
CREATE INDEX companies_domain_idx ON companies(domain);
CREATE UNIQUE INDEX companies_list_domain_uniq ON companies(list_id, domain) WHERE domain IS NOT NULL;

-- ─────────────────────────── runs & jobs ───────────────────────────

CREATE TABLE runs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id            UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  signal_profile_id  UUID NOT NULL REFERENCES signal_profiles(id),
  status             TEXT NOT NULL DEFAULT 'queued'
                     CHECK (status IN ('queued','running','complete','failed','halted_budget')),
  model              TEXT NOT NULL,
  search_provider    TEXT NOT NULL,
  started_at         TIMESTAMPTZ,
  finished_at        TIMESTAMPTZ,
  triggered_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  cost_usd           NUMERIC(10,4) NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX runs_list_idx ON runs(list_id, created_at DESC);

CREATE TABLE jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','claimed','done','failed')),
  attempts    INT NOT NULL DEFAULT 0,
  last_error  TEXT,
  locked_at   TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, company_id)
);
-- the worker's claim query (FOR UPDATE SKIP LOCKED) relies on this
CREATE INDEX jobs_claim_idx ON jobs(status, locked_at) WHERE status IN ('pending','claimed');

-- ─────────────────────────── results ───────────────────────────

CREATE TABLE company_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  fit_score         INT  NOT NULL CHECK (fit_score BETWEEN 0 AND 30),
  trigger_score     INT  NOT NULL CHECK (trigger_score BETWEEN 0 AND 70),
  total_score       INT  NOT NULL CHECK (total_score BETWEEN 0 AND 100),
  tier              TEXT NOT NULL CHECK (tier IN ('tier_1','tier_2','tier_3','defunct')),

  fwa_score         INT NOT NULL DEFAULT 0,
  starlink_score    INT NOT NULL DEFAULT 0,
  mobility_score    INT NOT NULL DEFAULT 0,
  byod_score        INT NOT NULL DEFAULT 0,
  primary_category  TEXT CHECK (primary_category IN ('FWA','STARLINK','MOBILITY','BYOD')),

  -- fit sub-scores, for the detail screen's anatomy bars
  fit_industry      INT NOT NULL DEFAULT 0,
  fit_size          INT NOT NULL DEFAULT 0,
  fit_multilocation INT NOT NULL DEFAULT 0,
  fit_geography     INT NOT NULL DEFAULT 0,

  industry          TEXT,
  hq                TEXT,
  size_label        TEXT,
  employee_estimate INT,
  location_count    INT,

  why_now           TEXT,        -- one-sentence trigger summary
  recommended_play  TEXT,        -- paraphrased, model-generated
  caveats           JSONB NOT NULL DEFAULT '[]'::jsonb,   -- ["enterprise_procurement", ...]
  recency_label     TEXT,
  confidence        NUMERIC(3,2),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, company_id)          -- makes retries an upsert, not a duplicate
);
CREATE INDEX results_rank_idx ON company_results(total_score DESC);
CREATE INDEX results_run_idx  ON company_results(run_id);

CREATE TABLE signals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_result_id  UUID NOT NULL REFERENCES company_results(id) ON DELETE CASCADE,
  event_type         TEXT NOT NULL,       -- key into the signal taxonomy
  categories         TEXT[] NOT NULL,     -- which of FWA/STARLINK/MOBILITY/BYOD it feeds
  title              TEXT NOT NULL,
  summary            TEXT NOT NULL,       -- PARAPHRASED. never > 25 words verbatim.
  event_date         DATE,
  is_forward         BOOLEAN NOT NULL DEFAULT FALSE,  -- announced future event
  recency_multiplier NUMERIC(3,2) NOT NULL,
  confidence         NUMERIC(3,2) NOT NULL,
  base_points        INT NOT NULL,
  points_awarded     NUMERIC(6,2) NOT NULL,
  source_url         TEXT NOT NULL,       -- NOT NULL on purpose: no source, no signal
  source_name        TEXT,
  source_class       TEXT CHECK (source_class IN ('primary','secondary','weak')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX signals_result_idx ON signals(company_result_id);

CREATE TABLE contacts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_result_id  UUID NOT NULL REFERENCES company_results(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  title              TEXT,
  role_rationale     TEXT,                -- "owns WAN + telecom; primary FWA buyer"
  linkedin_url       TEXT,
  email              TEXT,                -- Phase 2, Apollo only
  phone              TEXT,                -- Phase 2, Apollo only
  source             TEXT NOT NULL DEFAULT 'search'
                     CHECK (source IN ('search','apollo','manual')),
  verified           BOOLEAN NOT NULL DEFAULT FALSE,
  enriched_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX contacts_result_idx ON contacts(company_result_id);

-- ─────────────────────────── spend tracking ───────────────────────────

CREATE TABLE api_usage (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id         UUID REFERENCES runs(id) ON DELETE CASCADE,
  company_id     UUID REFERENCES companies(id) ON DELETE SET NULL,
  provider       TEXT NOT NULL,          -- 'anthropic' | 'brave' | 'apollo' | ...
  searches       INT NOT NULL DEFAULT 0,
  input_tokens   INT NOT NULL DEFAULT 0,
  output_tokens  INT NOT NULL DEFAULT 0,
  cost_usd       NUMERIC(10,6) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX api_usage_month_idx ON api_usage(created_at);

-- ─────────────────────────── views ───────────────────────────

-- latest run per list
CREATE VIEW latest_runs AS
SELECT DISTINCT ON (list_id) *
FROM runs
WHERE status = 'complete'
ORDER BY list_id, created_at DESC;

-- VIEW ALL: every company from every list's latest run, deduped by domain, best score wins
CREATE VIEW all_prospects AS
SELECT DISTINCT ON (COALESCE(c.domain, lower(c.name)))
       cr.*, c.name AS company_name, c.website, c.domain,
       l.id AS list_id, l.display_name AS list_name
FROM company_results cr
JOIN latest_runs lr ON lr.id = cr.run_id
JOIN companies  c  ON c.id  = cr.company_id
JOIN lists      l  ON l.id  = c.list_id
WHERE l.deleted_at IS NULL
ORDER BY COALESCE(c.domain, lower(c.name)), cr.total_score DESC, cr.created_at DESC;
