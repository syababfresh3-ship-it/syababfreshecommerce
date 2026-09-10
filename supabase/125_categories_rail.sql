-- ============================================================
-- 125_categories_rail.sql
-- Rail kategori katalog (/products) dipacu data, bukan slug hardcode.
--
-- Sebelum ini sf-catalog.tsx sorok kategori ikut senarai slug tetap
-- (makanan-minuman, buah-kering-kacang) dan gabung semua "kurma-*" ke satu
-- kumpulan "Kurma" ikut padanan string. Sekarang admin kawal sendiri
-- (Admin → Categories):
--   show_in_rail  — papar sebagai chip rail + seksyen sendiri dalam katalog.
--                   false = sorok chip; produknya digabung ke seksyen INDUK
--                   (kalau induk dipapar), jika tidak ke seksyen "Lain-lain".
--                   Produk aktif TIDAK pernah hilang dari katalog.
--   rail_order    — susunan chip dalam rail (kecil dulu). Seri → sort_order.
--
-- Seed di bawah kekalkan kelakuan hari ini secara tepat:
--   induk makanan-minuman & buah-kering-kacang disorok (anak kekal papar);
--   anak kurma-* disorok → digabung ke induk "kurma" yang dipapar di hujung (100).
-- Kod ada fallback: kalau lajur ini belum wujud, peraturan lama dipakai.
-- ADDITIVE. Idempotent — selamat dijalankan semula (seed akan ditetapkan semula).
-- ============================================================

alter table public.categories
  add column if not exists show_in_rail boolean not null default true;

alter table public.categories
  add column if not exists rail_order integer not null default 0;

comment on column public.categories.show_in_rail is
  'Papar sebagai chip rail + seksyen dalam katalog /products. false = produk digabung ke induk / Lain-lain.';
comment on column public.categories.rail_order is
  'Susunan chip rail katalog (kecil dulu; seri ikut sort_order).';

-- Seed: padankan kelakuan hardcode sebelum ini.
update public.categories
   set show_in_rail = false
 where slug in ('makanan-minuman', 'buah-kering-kacang');

-- Anak kurma-* (ikut parent "kurma" ATAU awalan slug) disorok → produk digabung ke induk.
update public.categories c
   set show_in_rail = false
 where c.slug like 'kurma-%'
    or c.parent_id = (select id from public.categories where slug = 'kurma');

-- Induk "Kurma" dipapar di hujung rail (macam sebelum ini).
update public.categories
   set show_in_rail = true, rail_order = 100
 where slug = 'kurma';
