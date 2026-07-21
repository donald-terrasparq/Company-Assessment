-- 0011: which contact-search filters produced the contacts shown on a result.
-- Auto-relaxation (department → titles → lower seniorities) records the step
-- that actually matched people, so the Top Contacts filter panel opens
-- reflecting the real state.
ALTER TABLE company_results ADD COLUMN contact_filters JSONB;
