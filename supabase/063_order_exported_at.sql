-- 063: mark when an order has been exported for shipping, so staff don't export /
-- ship the same order twice. Stamped by /api/admin/shipping/mark-exported when a
-- courier file (Ninja Cold / Lalamove / Poslaju) is generated. The exports list
-- hides already-exported orders by default.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS exported_at TIMESTAMPTZ;

ALTER TABLE public.lp_guest_orders
  ADD COLUMN IF NOT EXISTS exported_at TIMESTAMPTZ;
