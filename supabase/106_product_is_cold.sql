-- ============================================================
-- 106_product_is_cold.sql
-- Pisahkan dua konsep yang sebelum ni kongsi SATU bendera (punca order
-- LK tersasar ke Poslaju):
--   is_shippable = SKOP kawasan (true = boleh dipos seluruh Malaysia,
--                  false = Klang Valley sahaja — buah potong/mudah rosak)
--   is_cold      = COLD CHAIN (true = fresh/sejuk → Lalamove dlm LK,
--                  Ninja Cold luar LK; false = kering → Poslaju)
-- Default TRUE (sejuk) — majoriti katalog buah segar; admin untick untuk
-- item kering (jus botol, kurma, dsb) di form produk.
-- ADDITIVE. Idempotent. Run di Supabase SQL Editor.
-- ============================================================

alter table public.products
  add column if not exists is_cold boolean not null default true;

comment on column public.products.is_cold is
  'Perlu cold chain (fresh). false = barang kering, boleh Poslaju biasa.';
