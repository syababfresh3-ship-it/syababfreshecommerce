-- ============================================================
-- 136_variant_options.sql — variasi berdimensi gaya TikTok Shop (28 Sep 2026)
--
-- MASALAH: product_variants ialah SATU senarai rata per produk. Produk yang ada dua
-- paksi (cth Delima: Saiz × Promo) terpaksa dipecah jadi dua produk berasingan
-- (delima-tunisia-small / -large), setiap satu ulang varian promo yang sama.
-- Customer pilih produk dulu, baru promo — dua langkah, tak macam TikTok.
--
-- PENYELESAIAN (additive): setiap kombinasi KEKAL satu baris product_variants
-- (troli, order, WA, export ops, stok — semua guna variant_id + name, tak berubah).
-- Kita tambah lapisan "dimensi" di atasnya:
--   products.variant_options   [{ "name": "Saiz", "values": ["Small (150g+)", ...] },
--                               { "name": "Promo", "values": ["1 biji", ...] }]
--   product_variants.options   { "Saiz": "Large (300g+)", "Promo": "2 biji + FREE 2 biji" }
-- NULL = produk lama, senarai rata seperti sebelum ini. Lihat src/lib/variant-options.ts.
-- Idempotent. Tiada view → tiada security_invoker diperlukan.
-- ============================================================

alter table public.products
  add column if not exists variant_options jsonb;

alter table public.product_variants
  add column if not exists options jsonb;

comment on column public.products.variant_options is
  'Dimensi variasi (tertib): [{name, values[]}]. NULL = senarai varian rata (tiada dimensi).';
comment on column public.product_variants.options is
  'Nilai dimensi kombinasi ini: {"<dim>": "<value>"}. NULL = varian rata / legasi.';

-- Cari kombinasi ikut produk + nilai dimensi (pemilih & penjana kombinasi)
create index if not exists idx_product_variants_options
  on public.product_variants using gin (options) where options is not null;
