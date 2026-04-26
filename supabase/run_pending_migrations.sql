-- ============================================================
-- Jalankan semua ini di Supabase SQL Editor
-- Migrations 019 → 020 → 021 → 022 → 023
-- Idempotent — selamat dijalankan semula
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 019: Payment methods toggle
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_methods (
  id          text PRIMARY KEY,
  label       text NOT NULL,
  sublabel    text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  smallint NOT NULL DEFAULT 0
);

INSERT INTO payment_methods (id, label, sublabel, is_active, sort_order) VALUES
  ('fpx',          'FPX Online Banking',  'Semua bank Malaysia',             true, 0),
  ('ewallet',      'E-Wallet',            'Touch ''n Go · Boost · GrabPay',  true, 1),
  ('cod',          'Bayar Semasa Terima', 'Bayar tunai ketika barang tiba',  true, 2),
  ('bank_transfer','Pindahan Bank',       'Transfer terus ke akaun kami',    true, 3)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_methods_public_read" ON payment_methods;
CREATE POLICY "payment_methods_public_read"
  ON payment_methods FOR SELECT USING (true);

DROP POLICY IF EXISTS "payment_methods_admin_update" ON payment_methods;
CREATE POLICY "payment_methods_admin_update"
  ON payment_methods FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ));

-- ────────────────────────────────────────────────────────────
-- 020: Shipping carriers & order shipments
-- ────────────────────────────────────────────────────────────
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

DROP POLICY IF EXISTS "carriers_read" ON shipping_carriers;
CREATE POLICY "carriers_read" ON shipping_carriers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "carriers_admin_write" ON shipping_carriers;
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

DROP POLICY IF EXISTS "shipments_read" ON order_shipments;
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

-- ────────────────────────────────────────────────────────────
-- 021: Postcode delivery fee + app_settings
-- ────────────────────────────────────────────────────────────
ALTER TABLE delivery_zones
  ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 15.00;

ALTER TABLE delivery_zones
  ADD COLUMN IF NOT EXISTS carrier_id TEXT REFERENCES shipping_carriers(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_settings (key, value) VALUES
  ('default_delivery_fee', '15.00')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_read" ON app_settings;
CREATE POLICY "app_settings_read" ON app_settings FOR SELECT USING (true);

-- ────────────────────────────────────────────────────────────
-- 022: Product variants (berat/gred/pcs)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_variants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  price         DECIMAL(10,2) NOT NULL,
  compare_price DECIMAL(10,2),
  weight_grams  INTEGER,
  stock         INTEGER NOT NULL DEFAULT 0,
  sku           TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS variant_id   UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_name TEXT,
  ADD COLUMN IF NOT EXISTS weight_grams INTEGER;

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "variants_read" ON product_variants;
CREATE POLICY "variants_read" ON product_variants
  FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION deduct_variant_stock(p_variant_id UUID, p_quantity INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock INTEGER;
BEGIN
  SELECT stock INTO v_stock FROM product_variants WHERE id = p_variant_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variant tidak dijumpai';
  END IF;

  IF v_stock < p_quantity THEN
    RAISE EXCEPTION 'Stok tidak mencukupi';
  END IF;

  UPDATE product_variants SET stock = stock - p_quantity WHERE id = p_variant_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 023: cancel_order — pulihkan stok bila order dibatalkan
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cancel_order(p_order_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order record;
  v_item  record;
BEGIN
  SELECT id, user_id, status, created_at
    INTO v_order
    FROM public.orders
    WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Pesanan tidak dijumpai');
  END IF;

  IF v_order.user_id <> auth.uid() THEN
    RETURN json_build_object('ok', false, 'error', 'Tidak dibenarkan');
  END IF;

  IF v_order.status NOT IN ('pending', 'confirmed') THEN
    RETURN json_build_object('ok', false, 'error', 'Pesanan tidak boleh dibatalkan');
  END IF;

  IF extract(epoch FROM now() - v_order.created_at) > 1800 THEN
    RETURN json_build_object('ok', false, 'error', 'Masa batalkan telah tamat (30 minit)');
  END IF;

  -- Pulihkan stok hanya untuk 'confirmed' (stok dah ditolak)
  -- 'pending' = belum bayar FPX, stok belum ditolak lagi
  IF v_order.status = 'confirmed' THEN
    FOR v_item IN
      SELECT product_id, variant_id, quantity
        FROM public.order_items
        WHERE order_id = p_order_id
    LOOP
      IF v_item.variant_id IS NOT NULL THEN
        UPDATE public.product_variants
          SET stock = stock + v_item.quantity
          WHERE id = v_item.variant_id;
      ELSE
        -- Masukkan semula sebagai batch baru (expiry 1 tahun)
        INSERT INTO public.inventory_batches (product_id, quantity, batch_date, expiry_date)
          VALUES (v_item.product_id, v_item.quantity, current_date, current_date + interval '365 days');
      END IF;
    END LOOP;
  END IF;

  UPDATE public.orders
    SET status = 'cancelled', cancelled_at = now()
    WHERE id = p_order_id;

  RETURN json_build_object('ok', true);
END;
$$;
