-- ============================================================
-- 093_orders_postcode.sql
-- Simpan poskod berstruktur pada storefront orders (sebelum ni poskod divalidasi
-- + guna untuk fee, tapi DIBUANG — hanya kekal dalam teks delivery_address, itupun
-- tak selalu). lp_guest_orders dah ada lajur ini; orders tertinggal.
-- Backfill: cabut poskod 5-digit dari delivery_address untuk order sedia ada.
-- ADDITIVE. Idempotent. Run di Supabase SQL Editor.
-- ============================================================

alter table public.orders add column if not exists postcode text;

-- Backfill — ambil 5-digit pertama dalam delivery_address (di mana ada).
update public.orders
set postcode = (regexp_match(delivery_address, '\m(\d{5})\M'))[1]
where postcode is null
  and delivery_address is not null
  and delivery_address ~ '\m\d{5}\M';
