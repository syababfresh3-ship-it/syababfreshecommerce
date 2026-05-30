-- ============================================================
-- 052_lp_retro_payment.sql
-- Retro-claim LP loyalty hanya untuk order yang SUDAH dibayar.
--   - Pulangkan payment_method + payment_status supaya awardLpLoyalty()
--     boleh apply payment-guard yang sama (elak ganjar order belum bayar).
--   - Tapis terus di SQL: online (fpx/ewallet) mesti 'paid'; cod/bank
--     dikira settle masa delivery.
-- ============================================================

-- Return type berubah (tambah payment_method + payment_status) — Postgres tak
-- benarkan CREATE OR REPLACE tukar OUT params, jadi drop dulu.
drop function if exists public.lp_orders_for_phone(text);

create function public.lp_orders_for_phone(p_phone text)
returns table(
  id uuid,
  order_number text,
  phone text,
  total numeric,
  payment_method text,
  payment_status text
)
language sql stable as $$
  select o.id, o.order_number, o.phone, o.total, o.payment_method, o.payment_status
  from public.lp_guest_orders o
  where o.status = 'delivered'
    and o.loyalty_awarded = false
    and (o.payment_status = 'paid' or o.payment_method in ('cod', 'bank_transfer'))
    and length(regexp_replace(coalesce(o.phone, ''), '\D', '', 'g')) >= 9
    and right(regexp_replace(o.phone, '\D', '', 'g'), 9)
      = right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9)
  limit 50;
$$;
