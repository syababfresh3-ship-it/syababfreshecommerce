-- ============================================================
-- 043_lp_multi_item.sql
-- Sokong pelbagai produk dalam satu LP guest order
-- ============================================================

alter table public.lp_guest_orders
  add column if not exists items jsonb;

-- Buat product_id dan product_name nullable (order lama kekal, baru guna items jsonb)
alter table public.lp_guest_orders
  alter column product_id drop not null,
  alter column product_name drop not null;
