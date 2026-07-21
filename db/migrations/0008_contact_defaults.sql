-- 0008: admin-configurable Apollo contact-search defaults (Settings → Contacts).
-- CTS Mobility defaults: seniority Senior Manager / Director / VP (no C-level),
-- department IT, titles VP / Manager / Senior Manager.
ALTER TABLE settings ADD COLUMN contact_defaults JSONB NOT NULL DEFAULT
  '{"seniorities":["vp","director","manager"],"departments":["information_technology"],"titles":["VP","Manager","Senior Manager"]}';
