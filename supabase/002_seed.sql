-- ============================================================
-- SYABABFRESH — Seed Data
-- Run AFTER 001_schema.sql
-- ============================================================

-- ============================================================
-- LOYALTY TIERS
-- ============================================================
insert into public.loyalty_tiers (name, min_spend, multiplier, perks, sort_order) values
  ('Hijau',   0,      1.0, 'Asas — 1 point setiap RM1', 1),
  ('Perak',   500,    1.5, '1.5x points + free delivery RM5 kredit/bulan', 2),
  ('Emas',    2000,   2.0, '2x points + priority packing + free delivery', 3),
  ('Platinum', 5000,  3.0, '3x points + dedicated support + exclusive deals', 4);

-- ============================================================
-- CATEGORIES
-- ============================================================
insert into public.categories (name, slug, description, sort_order) values
  ('Buah Tempatan', 'buah-tempatan', 'Buah-buahan segar dari ladang tempatan Malaysia', 1),
  ('Buah Import',   'buah-import',   'Buah premium dari luar negara',                    2),
  ('Pakej Buah',    'pakej-buah',    'Pakej jimat pelbagai jenis buah',                  3),
  ('Buah Potong',   'buah-potong',   'Buah segar dipotong siap makan',                   4),
  ('Bermusim',      'bermusim',      'Buah musim khas — stok terhad!',                   5);

-- ============================================================
-- PRODUCTS
-- ============================================================
insert into public.products (category_id, name, slug, description, price, compare_price, unit, is_featured, sort_order)
select
  c.id,
  p.name,
  p.slug,
  p.description,
  p.price,
  p.compare_price,
  p.unit,
  p.is_featured,
  p.sort_order
from (values
  -- Buah Tempatan
  ('buah-tempatan', 'Durian Musang King',      'durian-musang-king',       'Durian premium Musang King dari Pahang. Isi tebal, manis dan creamy.',        89.90, 99.90,  'kg',   true,  1),
  ('buah-tempatan', 'Mangga Harumanis',         'mangga-harumanis',          'Mangga harumanis manis legit dari Perlis.',                                    15.90, null,   'kg',   true,  2),
  ('buah-tempatan', 'Rambutan Lebat',           'rambutan-lebat',            'Rambutan merah segar, manis dan berair.',                                      8.90,  null,   'kg',   false, 3),
  ('buah-tempatan', 'Betik Sekaki',             'betik-sekaki',              'Betik tempatan manis, sesuai untuk sajian harian.',                            6.90,  null,   'biji', false, 4),
  ('buah-tempatan', 'Nanas Morris',             'nanas-morris',              'Nanas Morris manis tanpa mata, mudah dimakan.',                                5.90,  null,   'biji', false, 5),

  -- Buah Import
  ('buah-import',   'Strawberry Korea',         'strawberry-korea',          'Strawberry besar dari Korea, manis dan segar.',                                29.90, 35.90,  'pack', true,  1),
  ('buah-import',   'Anggur Shine Muscat',       'anggur-shine-muscat',       'Anggur Jepun premium tanpa biji, manis dan rangup.',                           45.90, null,   'pack', true,  2),
  ('buah-import',   'Epal Fuji Jepun',           'epal-fuji-jepun',           'Epal Fuji Jepun, manis dan crispy.',                                           18.90, 22.90,  'kg',   false, 3),
  ('buah-import',   'Kiwi Zespri Gold',          'kiwi-zespri-gold',          'Kiwi emas dari New Zealand, lebih manis dari kiwi hijau.',                     24.90, null,   'pack', false, 4),
  ('buah-import',   'Oren Navel Australia',      'oren-navel-australia',      'Oren Navel segar dari Australia, berair dan manis.',                           12.90, null,   'kg',   false, 5),
  ('buah-import',   'Tembikai Seedless',         'tembikai-seedless',         'Tembikai tanpa biji import, merah dan berair.',                                19.90, 24.90,  'biji', false, 6),

  -- Pakej Buah
  ('pakej-buah',    'Pakej Keluarga A',          'pakej-keluarga-a',          'Mangga + Betik + Nanas + Rambutan. Cukup untuk 4-5 orang.',                    35.90, 45.90,  'set',  true,  1),
  ('pakej-buah',    'Pakej Premium Import',      'pakej-premium-import',      'Strawberry + Anggur + Kiwi. Hadiah atau majlis istimewa.',                     89.90, null,   'set',  true,  2),
  ('pakej-buah',    'Pakej Harian B',            'pakej-harian-b',            'Epal + Oren + Pisang + Betik. Bekalan buah 3-4 hari.',                         28.90, 34.90,  'set',  false, 3),

  -- Buah Potong
  ('buah-potong',   'Tembikai Potong',           'tembikai-potong',           'Tembikai merah dipotong segar, siap makan.',                                   8.90,  null,   'pack', false, 1),
  ('buah-potong',   'Campur Potong Tropical',    'campur-potong-tropical',    'Tembikai + Nanas + Betik dipotong. Sesuai untuk pejabat.',                      12.90, null,   'pack', false, 2),

  -- Bermusim
  ('bermusim',      'Durian Duri Hitam',         'durian-duri-hitam',         'Durian D200 Duri Hitam — stok terhad musim ini.',                              120.00, null,  'kg',   true,  1),
  ('bermusim',      'Langsat Johor',             'langsat-johor',             'Langsat manis dari Johor, musim sekali setahun.',                              12.90, null,   'kg',   false, 2)
) as p(cat_slug, name, slug, description, price, compare_price, unit, is_featured, sort_order)
join public.categories c on c.slug = p.cat_slug;

-- ============================================================
-- INVENTORY BATCHES (sample stock)
-- ============================================================
insert into public.inventory_batches (product_id, quantity, expiry_date, supplier)
select
  p.id,
  s.qty,
  current_date + s.shelf_days,
  'Pembekal Utama'
from (values
  ('durian-musang-king',    50,  3),
  ('mangga-harumanis',     100,  5),
  ('rambutan-lebat',       150,  4),
  ('betik-sekaki',          80,  7),
  ('nanas-morris',         120,  7),
  ('strawberry-korea',      60,  5),
  ('anggur-shine-muscat',   40,  7),
  ('epal-fuji-jepun',      200, 14),
  ('kiwi-zespri-gold',      80, 10),
  ('oren-navel-australia', 150, 10),
  ('tembikai-seedless',     30,  7),
  ('pakej-keluarga-a',      40,  3),
  ('pakej-premium-import',  20,  5),
  ('pakej-harian-b',        50,  3),
  ('tembikai-potong',       30,  2),
  ('campur-potong-tropical', 25, 2),
  ('durian-duri-hitam',     20,  3),
  ('langsat-johor',         60,  4)
) as s(slug, qty, shelf_days)
join public.products p on p.slug = s.slug;
