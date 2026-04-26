-- ============================================================
-- 025: is_shippable — tandakan produk yang boleh dipos
-- Default false = local delivery only (Klang Valley)
-- ============================================================
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_shippable boolean NOT NULL DEFAULT false;
