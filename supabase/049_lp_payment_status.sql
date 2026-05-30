-- ============================================================
-- 049_lp_payment_status.sql
-- Jejak bayaran sebenar untuk LP guest orders.
-- Sebelum ni "Paid" diteka dari payment_method (FPX = Paid) — salah,
-- sebab order yang customer "view je tak bayar" pun tunjuk Paid.
-- Webhook / verify-payment akan set 'paid' hanya bila CHIP sahkan bayaran.
-- ============================================================

alter table public.lp_guest_orders
  add column if not exists payment_status text not null default 'unpaid';
  -- nilai: unpaid | paid | failed

-- Backfill: FPX/e-wallet yang dah melepasi 'pending' (dah confirmed via webhook
-- atau admin) dianggap dah bayar. Yang masih 'pending' = belum bayar (mungkin
-- abandoned / view je) → kekal unpaid, perlu admin sahkan manual kalau betul bayar.
update public.lp_guest_orders
set payment_status = 'paid'
where payment_method in ('fpx', 'ewallet')
  and status not in ('pending', 'cancelled');
