-- ============================================================
-- 138_gift_weights.sql — berat (100g/500g/1kg) untuk Gift Studio (30 Sep 2026)
--
-- Pemilik: setiap gift ada pilihan berat kurma (100g / 500g / 1kg), dan BUKAN
-- semua design kotak sesuai dengan setiap berat. Jadi:
--   gift_boxes.weights   — senarai kod berat yang kotak ini SOKONG (subset).
--                          NULL / [] = sokong semua (kelakuan lama).
--   gift_fillings.prices — harga kurma ikut berat {"100g":x,"500g":y,"1kg":z}.
--                          Tiada entri untuk berat → guna lajur `price` (fallback).
-- Additive; kod tahan bila lajur/nilai tiada. Idempotent. Lihat lib/gift.ts.
-- ============================================================

alter table public.gift_boxes    add column if not exists weights jsonb;   -- ["100g","500g","1kg"]
alter table public.gift_fillings add column if not exists prices  jsonb;   -- {"100g":n,"500g":n,"1kg":n}

comment on column public.gift_boxes.weights  is 'Kod berat yang kotak ini sokong (subset 100g/500g/1kg). NULL = semua.';
comment on column public.gift_fillings.prices is 'Harga kurma ikut berat {"100g":n,...}. Tiada → guna lajur price.';
