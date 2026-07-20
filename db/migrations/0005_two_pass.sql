-- 0005: two-pass analysis. Pass 1 = balanced model for every company; the
-- escalation selector re-opens up to escalation_pct% of jobs as pass 2 with
-- the high-accuracy model. Results record which model produced them and why
-- they were escalated.
ALTER TABLE settings
  ADD COLUMN escalation_pct INT NOT NULL DEFAULT 20
  CHECK (escalation_pct IN (0, 20, 40, 60, 80, 100));

ALTER TABLE jobs ADD COLUMN pass INT NOT NULL DEFAULT 1;
ALTER TABLE jobs ADD COLUMN model_override TEXT;
ALTER TABLE jobs ADD COLUMN escalation_reasons JSONB NOT NULL DEFAULT '[]';

ALTER TABLE company_results ADD COLUMN model_used TEXT;
ALTER TABLE company_results ADD COLUMN escalation_reasons JSONB NOT NULL DEFAULT '[]';
