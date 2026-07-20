-- 0006: most recent full-year revenue (USD) for the detail header, alongside
-- the existing employee_estimate. Sourced from filings/reference data.
ALTER TABLE company_results ADD COLUMN annual_revenue_usd BIGINT;
