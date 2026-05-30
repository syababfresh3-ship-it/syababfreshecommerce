-- ============================================================
-- 055_refund_baucar_promo.sql
-- Method refund 'baucar' jana KOD PROMO sebenar (promo_codes) bila Selesai.
-- Tambah link dari refund → promo yang dijana (untuk papar + idempotency).
-- Flag `loyalty_credited` (sedia ada) diguna semula sebagai "baucar issued".
-- ============================================================

alter table public.refunds
  add column if not exists baucar_promo_id uuid references public.promo_codes(id) on delete set null;
