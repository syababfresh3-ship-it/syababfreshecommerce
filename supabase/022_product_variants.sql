-- ────────────────────────────────────────────────────────
-- 022_product_variants.sql  —  Variasi produk (berat/gred/pcs)
-- ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_variants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,              -- "1kg", "3kg Gred A", "6 biji"
  price         DECIMAL(10,2) NOT NULL,
  compare_price DECIMAL(10,2),
  weight_grams  INTEGER,                   -- untuk kira kos shipping
  stock         INTEGER NOT NULL DEFAULT 0,
  sku           TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tambah variant info ke order_items
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS variant_id   UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_name TEXT,
  ADD COLUMN IF NOT EXISTS weight_grams INTEGER;

-- RLS
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "variants_read" ON product_variants
  FOR SELECT USING (true);

-- Fungsi deduct stok variant
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
