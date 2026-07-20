-- 0003: model-generated coverage observations (good/warn) for the company
-- detail "Coverage & caveats" panel — e.g. Verizon footprint fit, decision
-- locality. Shape: [{ "tone": "good"|"warn", "note": "…" }]
ALTER TABLE company_results
  ADD COLUMN coverage_notes JSONB NOT NULL DEFAULT '[]'::jsonb;
