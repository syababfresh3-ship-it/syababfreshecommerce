-- ────────────────────────────────────────────────────────
-- 020_shipping.sql  —  Shipping carriers & order shipments
-- ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shipping_carriers (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  config                JSONB NOT NULL DEFAULT '{}',
  tracking_url_template TEXT,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO shipping_carriers (id, name, sort_order, tracking_url_template) VALUES
  ('poslaju',    'Poslaju',        1, 'https://www.tracking.my/poslaju/{number}'),
  ('ninja_cold', 'Ninja Van Cold', 2, 'https://www.ninjavan.co/en-my/tracking?id={number}'),
  ('line_clear', 'Line Clear',     3, 'https://www.lineclearexpress.com/track/{number}'),
  ('lalamove',   'Lalamove',       4, NULL)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE shipping_carriers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "carriers_read" ON shipping_carriers
  FOR SELECT USING (true);

-- Admin boleh update/insert carriers (toggle, config)
CREATE POLICY "carriers_admin_write" ON shipping_carriers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE TABLE IF NOT EXISTS order_shipments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  carrier_id         TEXT NOT NULL REFERENCES shipping_carriers(id),
  tracking_number    TEXT,
  tracking_url       TEXT,
  status             TEXT NOT NULL DEFAULT 'pending',
  notes              TEXT,
  shipped_at         TIMESTAMPTZ,
  estimated_delivery DATE,
  delivered_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS order_shipments_order_id_key ON order_shipments(order_id);

ALTER TABLE order_shipments ENABLE ROW LEVEL SECURITY;

-- Customer reads their own shipment; admin reads all
CREATE POLICY "shipments_read" ON order_shipments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_shipments.order_id
        AND orders.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );
