-- 062: per-product shipping weight (for products sold without variants)
-- Variants already carry weight_grams (migration 022). Base products fell back
-- to 500g in the weight-based Ninja Cold shipping calc; this lets admin set a
-- real weight per product so non-variant items are billed at the correct tier.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS weight_grams INTEGER;   -- shipping weight in grams; NULL = fallback 500g
