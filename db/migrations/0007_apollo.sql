-- 0007: Apollo.io contact enrichment (Phase 7).
-- apollo_person_id lets the on-demand email/phone reveal enrich by exact
-- Apollo id instead of a fuzzy name+domain match. phone_requested_at tracks
-- the async phone reveal (Apollo delivers numbers via webhook, not inline).
ALTER TABLE contacts ADD COLUMN apollo_person_id TEXT;
ALTER TABLE contacts ADD COLUMN phone_requested_at TIMESTAMPTZ;
