-- 0015: user annotations that survive re-analysis — notes, per-user viewed
-- state, manually entered contacts, and per-company contact search hints.
-- All additive. Keyed on companies (not company_results) because result and
-- contact rows are deleted and rewritten on every re-run; nothing a user
-- types may live there.

CREATE TABLE company_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  body        TEXT NOT NULL CHECK (char_length(body) <= 5000),
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX company_notes_company_idx ON company_notes(company_id, created_at DESC);

-- which companies each user has opened the detail page for
CREATE TABLE company_views (
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_viewed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, company_id)
);
CREATE INDEX company_views_company_idx ON company_views(company_id);

-- user-entered contacts and corrections to auto-found contacts.
-- overrides_name marks a row as a correction: at render time its non-empty
-- fields win over the auto-found contact with that (case-insensitive) name.
CREATE TABLE manual_contacts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  first_name     TEXT NOT NULL,
  last_name      TEXT,
  title          TEXT,
  email          TEXT,
  phone          TEXT,
  overrides_name TEXT,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX manual_contacts_company_idx ON manual_contacts(company_id);

-- per-company hints that steer the Apollo contact search (never relaxed away)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_name_hints  TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_title_hints TEXT[] NOT NULL DEFAULT '{}';
