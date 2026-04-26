-- ────────────────────────────────────────────────────────
-- 021_postcode_fees.sql  —  Delivery fee per kawasan/poskod
-- ────────────────────────────────────────────────────────

-- Tambah kolum delivery_fee ke delivery_zones (default RM15)
ALTER TABLE delivery_zones
  ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 15.00;

-- Kurier yang handle kawasan ini (rujukan admin)
ALTER TABLE delivery_zones
  ADD COLUMN IF NOT EXISTS carrier_id TEXT REFERENCES shipping_carriers(id) ON DELETE SET NULL;

-- Tetapan app: kadar lalai untuk poskod di luar delivery_zones
CREATE TABLE IF NOT EXISTS app_settings (
  key     TEXT PRIMARY KEY,
  value   TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_settings (key, value) VALUES
  ('default_delivery_fee', '15.00')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_settings_read" ON app_settings FOR SELECT USING (true);
