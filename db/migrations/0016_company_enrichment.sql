-- 0016: durable Apollo company-enrichment snapshot (Company detail page,
-- "Company enrichment" card below Press & sources). One row per company,
-- upserted automatically during analysis and on-demand via the re-enrich
-- button. Additive only; keyed on companies so re-analysis never orphans it.

CREATE TABLE company_enrichment (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  linkedin_url           TEXT,
  description            TEXT,
  industry               TEXT,
  founded_year           INT,
  employees              INT,
  annual_revenue_usd     BIGINT,
  location_count         INT,
  publicly_traded_symbol TEXT,
  total_funding          TEXT,            -- Apollo's printed form, e.g. "$12.5M"
  latest_funding_stage   TEXT,
  latest_funding_date    TEXT,            -- YYYY-MM-DD
  keywords               TEXT[] NOT NULL DEFAULT '{}',   -- detected tech / keywords
  news                   JSONB NOT NULL DEFAULT '[]',    -- [{title,url,date,event}]
  enriched_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
