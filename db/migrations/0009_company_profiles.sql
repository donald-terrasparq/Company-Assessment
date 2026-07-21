-- 0009: invite/user names + re-brandable company profiles (Settings → Company).
ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN last_name TEXT;
ALTER TABLE invites ADD COLUMN first_name TEXT;
ALTER TABLE invites ADD COLUMN last_name TEXT;
ALTER TABLE invites ADD COLUMN email TEXT;

-- who the SELLER is: company facts, up to 4 products mapped onto the four
-- internal signal slots, and the AI context text that steers research/emails
CREATE TABLE company_profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  website     TEXT,
  industry    TEXT,
  products    JSONB NOT NULL DEFAULT '[]',
  ai_context  JSONB NOT NULL DEFAULT '{}',
  is_active   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX company_profiles_active_uniq ON company_profiles(is_active) WHERE is_active;

INSERT INTO company_profiles (name, website, industry, products, ai_context, is_active) VALUES (
  'CTS Mobility', 'www.ctsmobility.com', 'Telecommunications',
  '[{"slot":"FWA","label":"FWA","description":"Fixed Wireless Access: primary or backup internet over cellular. Sold when a company opens, moves into, or builds a physical site, or needs connectivity fast."},
    {"slot":"STARLINK","label":"Starlink","description":"Satellite failover for uptime-critical or low-redundancy sites."},
    {"slot":"MOBILITY","label":"Mobility","description":"Managed devices: Apple/Samsung phones and tablets, Zebra rugged scanners. Sold when a company hires frontline staff, runs field/warehouse/clinical operations, or refreshes devices."},
    {"slot":"BYOD","label":"BYOD","description":"Managing personal devices for distributed, remote, contractor, or agent workforces."}]',
  '{"companyDescription":"CTS Mobility is a Verizon partner selling: Fixed Wireless Access (fast primary/backup internet over cellular), Starlink satellite failover, managed mobility (phones/tablets/rugged devices), and BYOD management.",
    "signalGuidance":"Favor physical-footprint events (new sites, expansions, relocations), uptime/continuity pressure, frontline hiring, and device-fleet moments. IT teams are the primary buyers.",
    "searchKeywords":"new location, expansion, network, connectivity, internet outage, devices, tablets, field workforce"}',
  TRUE
);
