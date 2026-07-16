-- 0002: one-time invite codes for Settings → Users (Phase 1, ticket 1.4)
CREATE TABLE invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
