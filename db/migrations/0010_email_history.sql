-- 0010: drafted-email history. Tied to the COMPANY (not a run's result row),
-- so history survives re-analysis. Play and contact are stored as text
-- snapshots — plays change across runs and contact rows are rewritten.
CREATE TABLE drafted_emails (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_name      TEXT,
  play_text         TEXT NOT NULL,
  style_key         TEXT NOT NULL,
  sequence_position INT NOT NULL DEFAULT 1,
  sequence_length   INT NOT NULL DEFAULT 1,
  subject           TEXT NOT NULL,
  body              TEXT NOT NULL,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX drafted_emails_company_idx ON drafted_emails(company_id, created_at DESC);
