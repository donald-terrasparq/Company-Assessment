-- 0004: run retention (Phase 6). Runs older than settings.retention_days are
-- soft-deleted by a daily worker sweep; their signals (the bulky part) are
-- dropped. latest_runs/all_prospects must ignore soft-deleted runs.
ALTER TABLE runs ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE OR REPLACE VIEW latest_runs AS
SELECT DISTINCT ON (list_id) *
FROM runs
WHERE status = 'complete' AND deleted_at IS NULL
ORDER BY list_id, created_at DESC;
