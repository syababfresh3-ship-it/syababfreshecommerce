-- ============================================================
-- 075_refund_lp_order.sql
-- Sokong "Refund Terperinci" untuk LP / reseller guest orders.
-- Sebelum ni refunds.order_id WAJIB rujuk orders(id) — jadi order
-- LP (lp_guest_orders) tak boleh dibuat refund terperinci.
-- Sekarang: order_id jadi nullable + tambah lp_order_id. Tepat SATU
-- daripada keduanya mesti diisi (storefront ATAU LP).
-- Idempotent — selamat dijalankan semula.
-- ============================================================

alter table public.refunds
  alter column order_id drop not null;

alter table public.refunds
  add column if not exists lp_order_id uuid
    references public.lp_guest_orders(id) on delete cascade;

-- Tepat satu sumber order (XOR). Row sedia ada (order_id terisi, lp_order_id null)
-- lulus secara automatik.
alter table public.refunds
  drop constraint if exists refunds_one_order_chk;
alter table public.refunds
  add constraint refunds_one_order_chk
  check (num_nonnulls(order_id, lp_order_id) = 1);

create index if not exists idx_refunds_lp_order on public.refunds(lp_order_id);
