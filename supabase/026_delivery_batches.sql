-- ============================================================
-- 026: Delivery Batches — Lalamove same-day grouping
-- Run in: Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS delivery_batches (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code  text    NOT NULL,
  batch_date  date    NOT NULL,
  cutoff_time time    NOT NULL DEFAULT '15:00',
  zone_id     text    NOT NULL,
  zone_name   text    NOT NULL,
  status      text    NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','ready','booked','delivered')),
  notes       text,
  stop_count  integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_batch_orders (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      uuid    REFERENCES delivery_batches(id) ON DELETE CASCADE,
  order_id      uuid    REFERENCES orders(id)           ON DELETE CASCADE,
  stop_sequence integer DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(batch_id, order_id)
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_delivery_batches_date   ON delivery_batches(batch_date);
CREATE INDEX IF NOT EXISTS idx_delivery_batch_orders_b ON delivery_batch_orders(batch_id);
CREATE INDEX IF NOT EXISTS idx_delivery_batch_orders_o ON delivery_batch_orders(order_id);

-- RLS — admin only (service role bypasses entirely)
ALTER TABLE delivery_batches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_batch_orders  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin all delivery_batches"       ON delivery_batches;
DROP POLICY IF EXISTS "Admin all delivery_batch_orders"  ON delivery_batch_orders;

CREATE POLICY "Admin all delivery_batches" ON delivery_batches
  FOR ALL TO authenticated
  USING   (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admin all delivery_batch_orders" ON delivery_batch_orders
  FOR ALL TO authenticated
  USING   (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_delivery_batch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_batches_updated_at ON delivery_batches;
CREATE TRIGGER trg_delivery_batches_updated_at
  BEFORE UPDATE ON delivery_batches
  FOR EACH ROW EXECUTE FUNCTION update_delivery_batch_updated_at();
