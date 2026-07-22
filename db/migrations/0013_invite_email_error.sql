-- 0013: record WHY an invite email failed so the Users tab can show the
-- exact Resend error instead of a bare NOT EMAILED badge.
ALTER TABLE invites ADD COLUMN IF NOT EXISTS email_error TEXT;
