-- 0014: selectable invite-email provider (Settings → Users): Resend or Brevo.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS email_provider TEXT NOT NULL DEFAULT 'resend'
  CHECK (email_provider IN ('resend', 'brevo'));
