-- 0012: track when an invite email was delivered via Resend.
ALTER TABLE invites ADD COLUMN email_sent_at TIMESTAMPTZ;
