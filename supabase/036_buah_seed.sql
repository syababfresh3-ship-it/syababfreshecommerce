-- ============================================================
-- 036_buah_seed.sql
-- Seed produk buah segar SyababFresh (dari Copy of Buah TikTok 1)
-- Harga = sama dengan TikTok (margin lebih baik tanpa komisyen platform)
-- is_shippable = false (penghantaran Klang Valley sahaja)
-- ============================================================

-- Tambah kategori buah
INSERT INTO categories (name, slug, sort_order) VALUES
  ('Durian', 'durian', 20),
  ('Durian Frozen', 'durian-frozen', 21),
  ('Harumanis', 'harumanis', 22),
  ('Buah Import', 'buah-import', 23),
  ('Buah Tempatan', 'buah-tempatan', 24),
  ('Delima', 'delima', 25),
  ('Kurma Muda & Segar', 'kurma-muda-segar', 26),
  ('Jus & Minuman', 'jus-minuman', 27),
  ('Ready to Eat', 'ready-to-eat', 28),
  ('Gift Box & Set', 'gift-box-set', 29)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  cat_durian     uuid;
  cat_frozen     uuid;
  cat_harumanis  uuid;
  cat_import     uuid;
  cat_tempatan   uuid;
  cat_delima     uuid;
  cat_kurma_muda uuid;
  cat_jus        uuid;
  cat_rte        uuid;
  cat_giftbox    uuid;
  pid            uuid;

BEGIN

  SELECT id INTO cat_durian    FROM categories WHERE slug = 'durian';
  SELECT id INTO cat_frozen    FROM categories WHERE slug = 'durian-frozen';
  SELECT id INTO cat_harumanis FROM categories WHERE slug = 'harumanis';
  SELECT id INTO cat_import    FROM categories WHERE slug = 'buah-import';
  SELECT id INTO cat_tempatan  FROM categories WHERE slug = 'buah-tempatan';
  SELECT id INTO cat_delima    FROM categories WHERE slug = 'delima';
  SELECT id INTO cat_kurma_muda FROM categories WHERE slug = 'kurma-muda-segar';
  SELECT id INTO cat_jus       FROM categories WHERE slug = 'jus-minuman';
  SELECT id INTO cat_rte       FROM categories WHERE slug = 'ready-to-eat';
  SELECT id INTO cat_giftbox   FROM categories WHERE slug = 'gift-box-set';

  -- ============================================================
  -- DURIAN: MUSANG KING (TEMPATAN)
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Musang King', 'musang-king', 89.00, 'pack', cat_durian, true, false, 1)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',  89.00,  500, true, 1),
      (pid, '1kg',  130.00, 1000, true, 2),
      (pid, '2kg',  270.00, 2000, true, 3);
  END IF;

  -- ============================================================
  -- DURIAN: MUSANG KING THAI
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Musang King THAI', 'musang-king-thai', 89.00, 'pack', cat_durian, true, false, 2)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',   89.00,  500, true, 1),
      (pid, '1kg',   150.00, 1000, true, 2),
      (pid, '2kg',   280.00, 2000, true, 3);
  END IF;

  -- ============================================================
  -- DURIAN: UDANG MERAH / PAMANI
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Pamani / Udang Merah', 'pamani-udang-merah', 79.00, 'pack', cat_durian, true, false, 3)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',   79.00,  500, true, 1),
      (pid, '1kg',   119.00, 1000, true, 2),
      (pid, '2kg',   229.00, 2000, true, 3);
  END IF;

  -- ============================================================
  -- DURIAN: UDANG MERAH (THAI)
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Udang Merah Thai', 'udang-merah-thai', 109.00, 'pack', cat_durian, true, false, 4)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',  109.00,  500, true, 1),
      (pid, '1kg',   169.00, 1000, true, 2),
      (pid, '2kg',   329.00, 2000, true, 3);
  END IF;

  -- ============================================================
  -- DURIAN: CENI TEMBAGA
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Ceni Tembaga', 'ceni-tembaga', 69.00, 'pack', cat_durian, true, false, 5)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',   69.00,  500, true, 1),
      (pid, '1kg',    99.00, 1000, true, 2),
      (pid, '2kg',   180.00, 2000, true, 3);
  END IF;

  -- ============================================================
  -- DURIAN: D13 / UDANG MERAH
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('D13 / Udang Merah', 'd13-udang-merah', 85.00, 'pack', cat_durian, true, false, 6)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',   85.00,  500, true, 1),
      (pid, '1kg',   125.00, 1000, true, 2),
      (pid, '2kg',   240.00, 2000, true, 3);
  END IF;

  -- ============================================================
  -- DURIAN: KAMPUNG KAHWIN
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Durian Kampung Kahwin', 'durian-kampung-kahwin', 59.00, 'pack', cat_durian, true, false, 7)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',   59.00,  500, true, 1),
      (pid, '1kg',    89.00, 1000, true, 2),
      (pid, '2kg',   169.00, 2000, true, 3);
  END IF;

  -- ============================================================
  -- DURIAN: BLACKTHORN
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Blackthorn', 'blackthorn', 105.00, 'pack', cat_durian, true, false, 8)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',  105.00,  500, true, 1),
      (pid, '1kg',   130.00, 1000, true, 2),
      (pid, '2kg',   290.00, 2000, true, 3);
  END IF;

  -- ============================================================
  -- DURIAN: D24
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('D24', 'd24', 69.00, 'pack', cat_durian, true, false, 9)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',  69.00,  500, true, 1),
      (pid, '1kg',   68.00, 1000, true, 2),
      (pid, '2kg',  130.00, 2000, true, 3);
  END IF;

  -- ============================================================
  -- DURIAN: IOI
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('IOI', 'ioi', 59.00, 'pack', cat_durian, true, false, 10)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',   59.00,  500, true, 1),
      (pid, '1kg',    90.00, 1000, true, 2),
      (pid, '2kg',   170.00, 2000, true, 3);
  END IF;

  -- ============================================================
  -- DURIAN: DURIAN MONTHONG
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Durian Monthong', 'durian-monthong', 59.00, 'pack', cat_durian, true, false, 11)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',   59.00,  500, true, 1),
      (pid, '1kg',    89.00, 1000, true, 2),
      (pid, '2kg',   169.00, 2000, true, 3),
      (pid, '1 pek (600g)',   69.00,  600, true, 4),
      (pid, '2 pek (1.2kg)',  99.00, 1200, true, 5),
      (pid, '3 pek (1.8kg)', 139.00, 1800, true, 6),
      (pid, '4 pek (2.4kg)', 179.00, 2400, true, 7);
  END IF;

  -- ============================================================
  -- DURIAN: DURIAN KAMPUNG
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Durian Kampung', 'durian-kampung', 35.00, 'pack', cat_durian, true, false, 12)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',   35.00,  500, true, 1),
      (pid, '1kg',    60.00, 1000, true, 2),
      (pid, '2kg',   115.00, 2000, true, 3);
  END IF;

  -- ============================================================
  -- DURIAN COMBO
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Combo MK + Udang Merah', 'combo-mk-udang-merah', 85.00, 'pack', cat_durian, true, false, 13)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g (250g MK + 250g UM)',  85.00,  500, true, 1),
      (pid, '1kg (500g MK + 500g UM)',  130.00, 1000, true, 2),
      (pid, '2kg (1kg MK + 1kg UM)',    250.00, 2000, true, 3);
  END IF;

  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Combo MK + Kampung Kahwin', 'combo-mk-kampung-kahwin', 75.00, 'pack', cat_durian, true, false, 14)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g (250g MK + 250g KK)',   75.00,  500, true, 1),
      (pid, '1kg (500g MK + 500g KK)',   110.00, 1000, true, 2),
      (pid, '2kg (1kg MK + 1kg KK)',     200.00, 2000, true, 3);
  END IF;

  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Combo D24 + MK', 'combo-d24-mk', 89.00, 'pack', cat_durian, true, false, 15)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',   89.00,  500, true, 1),
      (pid, '1kg',   129.00, 1000, true, 2),
      (pid, '2kg',   180.00, 2000, true, 3);
  END IF;

  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Combo UM + IOI', 'combo-um-ioi', 129.00, 'pack', cat_durian, true, false, 16)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1kg',  129.00, 1000, true, 1),
      (pid, '2kg',  239.00, 2000, true, 2);
  END IF;

  -- ============================================================
  -- DURIAN FROZEN
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('[FROZEN] Musang King', 'frozen-musang-king', 65.00, 'pack', cat_frozen, true, true, 1)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',  65.00,  500, true, 1),
      (pid, '1kg',  110.00, 1000, true, 2);
  END IF;

  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('[FROZEN] Blackthorn', 'frozen-blackthorn', 65.00, 'pack', cat_frozen, true, true, 2)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',  65.00,  500, true, 1),
      (pid, '1kg',  110.00, 1000, true, 2);
  END IF;

  -- ============================================================
  -- HARUMANIS PERLIS
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Harumanis Perlis', 'harumanis-perlis', 59.00, 'pack', cat_harumanis, true, false, 1)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1kg',   59.00, 1000, true, 1),
      (pid, '3kg',  139.00, 3000, true, 2),
      (pid, '5kg',  219.00, 5000, true, 3);
  END IF;

  -- ============================================================
  -- BUAH IMPORT: STRAWBERRY USA
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Strawberry USA', 'strawberry-usa', 25.00, 'pack', cat_import, true, false, 1)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 pack', 25.00, NULL, true, 1),
      (pid, '2 pack', 45.00, NULL, true, 2),
      (pid, '3 pack', 63.00, NULL, true, 3);
  END IF;

  -- ============================================================
  -- BUAH IMPORT: AVOCADO AUSTRALIA
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Avocado Australia', 'avocado-australia', 7.00, 'biji', cat_import, true, false, 2)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 biji',  7.00, NULL, true, 1),
      (pid, '3 biji', 18.00, NULL, true, 2),
      (pid, '5 biji', 26.00, NULL, true, 3);
  END IF;

  -- ============================================================
  -- BUAH IMPORT: APPLE FUJI XL
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Apple Fuji XL', 'apple-fuji-xl', 8.00, 'biji', cat_import, true, false, 3)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 biji',   8.00, NULL, true, 1),
      (pid, '5 biji',  25.00, NULL, true, 2),
      (pid, '10 biji', 45.00, NULL, true, 3);
  END IF;

  -- ============================================================
  -- BUAH IMPORT: NAVEL ORANGE SUNKIST
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Navel Orange Sunkist', 'navel-orange-sunkist', 7.00, 'biji', cat_import, true, false, 4)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 biji',   7.00, NULL, true, 1),
      (pid, '5 biji',  25.00, NULL, true, 2),
      (pid, '10 biji', 45.00, NULL, true, 3);
  END IF;

  -- ============================================================
  -- BUAH IMPORT: CARA ORANGE XL
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Cara Orange XL', 'cara-orange-xl', 12.00, 'biji', cat_import, true, false, 5)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '3 biji',  12.00, NULL, true, 1),
      (pid, '6 biji',  23.00, NULL, true, 2),
      (pid, '12 biji', 40.00, NULL, true, 3);
  END IF;

  -- ============================================================
  -- BUAH IMPORT: MINI SWEET ORANGE
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Mini Sweet Orange', 'mini-sweet-orange', 10.00, 'pack', cat_import, true, false, 6)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',  10.00,  500, true, 1),
      (pid, '1kg',   15.00, 1000, true, 2),
      (pid, '2kg',   25.00, 2000, true, 3);
  END IF;

  -- ============================================================
  -- BUAH IMPORT: FRESH FIGS TURKEY
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Fresh Figs Turkey', 'fresh-figs-turkey', 25.00, 'pack', cat_import, true, false, 7)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 pack', 25.00, NULL, true, 1),
      (pid, '2 pack', 42.00, NULL, true, 2),
      (pid, '3 pack', 57.00, NULL, true, 3);
  END IF;

  -- ============================================================
  -- BUAH IMPORT: HAMI MELON
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Hami Melon', 'hami-melon', 19.00, 'biji', cat_import, true, false, 8)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 biji', 19.00, NULL, true, 1),
      (pid, '2 biji', 35.00, NULL, true, 2),
      (pid, '3 biji', 57.00, NULL, true, 3);
  END IF;

  -- ============================================================
  -- BUAH IMPORT: CRIMSON GRAPES AUSTRALIA
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Crimson Grapes Australia', 'crimson-grapes-australia', 14.00, 'pack', cat_import, true, false, 9)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',  14.00,  500, true, 1),
      (pid, '1kg',   22.00, 1000, true, 2),
      (pid, '2kg',   45.00, 2000, true, 3);
  END IF;

  -- ============================================================
  -- BUAH IMPORT: SWEET GLOBE (ANGGUR)
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Sweet Globe', 'sweet-globe', 24.00, 'pack', cat_import, true, false, 10)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',  24.00,  500, true, 1),
      (pid, '1kg',   45.00, 1000, true, 2),
      (pid, '2kg',   79.00, 2000, true, 3);
  END IF;

  -- ============================================================
  -- BUAH IMPORT: SHINE MUSCAT
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Shine Muscat', 'shine-muscat', 11.00, 'pack', cat_import, true, false, 11)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 pack', 11.00, NULL, true, 1),
      (pid, '3 pack', 32.00, NULL, true, 2),
      (pid, '5 pack', 50.00, NULL, true, 3);
  END IF;

  -- ============================================================
  -- BUAH IMPORT: AUTUMN CRISP (ANGGUR CHILE)
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Autumn Crisp Chile', 'autumn-crisp-chile', 45.00, 'pack', cat_import, true, false, 12)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',   45.00,  500, true, 1),
      (pid, '1kg',    79.00, 1000, true, 2),
      (pid, '2kg',   149.00, 2000, true, 3);
  END IF;

  -- ============================================================
  -- BUAH IMPORT: MIDNIGHT BEAUTY EGYPT
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Midnight Beauty Egypt', 'midnight-beauty-egypt', 19.00, 'pack', cat_import, true, false, 13)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',  19.00,  500, true, 1),
      (pid, '1kg',   35.00, 1000, true, 2),
      (pid, '2kg',   65.00, 2000, true, 3);
  END IF;

  -- ============================================================
  -- BUAH IMPORT: DONUT PEACH TURKEY
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Donut Peach Turkey', 'donut-peach-turkey', 22.00, 'pack', cat_import, true, false, 14)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 pack',   22.00, NULL, true, 1),
      (pid, '3 pack',   65.00, NULL, true, 2),
      (pid, '5 pack',  105.00, NULL, true, 3);
  END IF;

  -- ============================================================
  -- BUAH IMPORT: GREEN KIWI ZESPRI
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Green Kiwi Zespri', 'green-kiwi-zespri', 21.00, 'pack', cat_import, true, false, 15)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 pack (4pcs)', 21.00, NULL, true, 1),
      (pid, '3 pack',        59.00, NULL, true, 2),
      (pid, '5 pack',        89.00, NULL, true, 3);
  END IF;

  -- ============================================================
  -- BUAH IMPORT: BLUEBERRY JUMBO CN
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Blueberry Jumbo CN', 'blueberry-jumbo-cn', 17.00, 'pack', cat_import, true, false, 16)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 pack', 17.00, NULL, true, 1),
      (pid, '3 pack', 45.00, NULL, true, 2),
      (pid, '5 pack', 69.00, NULL, true, 3);
  END IF;

  -- ============================================================
  -- BUAH IMPORT: APRIKOT TURKEY (FRESH)
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Aprikot Turkey', 'aprikot-turkey', 29.00, 'pack', cat_import, true, false, 17)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 pack',   29.00, NULL, true, 1),
      (pid, '3 pack',   79.00, NULL, true, 2),
      (pid, '5 pack',  125.00, NULL, true, 3);
  END IF;

  -- ============================================================
  -- BUAH IMPORT: PERSIMMON SA
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Persimmon SA', 'persimmon-sa', 19.00, 'pack', cat_import, true, false, 18)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 pack', 19.00, NULL, true, 1),
      (pid, '2 pack', 33.00, NULL, true, 2),
      (pid, '3 pack', 42.00, NULL, true, 3);
  END IF;

  -- ============================================================
  -- BUAH IMPORT: RED APPLE NEW ZEALAND
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Red Apple New Zealand', 'red-apple-new-zealand', 9.00, 'biji', cat_import, true, false, 19)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '3 biji',   9.00, NULL, true, 1),
      (pid, '5 biji',  14.00, NULL, true, 2),
      (pid, '10 biji', 25.00, NULL, true, 3);
  END IF;

  -- ============================================================
  -- BUAH IMPORT: PACKHAM PEAR CHINA
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Packham Pear China', 'packham-pear-china', 9.00, 'biji', cat_import, true, false, 20)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '3 biji',   9.00, NULL, true, 1),
      (pid, '5 biji',  14.00, NULL, true, 2),
      (pid, '10 biji', 25.00, NULL, true, 3);
  END IF;

  -- ============================================================
  -- BUAH IMPORT: FORELLA PEAR
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Forella Pear', 'forella-pear', 6.00, 'biji', cat_import, true, false, 21)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 biji',   6.00, NULL, true, 1),
      (pid, '3 biji',  10.00, NULL, true, 2),
      (pid, '5 biji',  14.00, NULL, true, 3),
      (pid, '10 biji', 25.00, NULL, true, 4);
  END IF;

  -- ============================================================
  -- BUAH IMPORT: SINGO PEAR
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Singo Pear', 'singo-pear', 5.00, 'biji', cat_import, true, false, 22)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 biji',  5.00, NULL, true, 1),
      (pid, '3 biji', 13.90, NULL, true, 2),
      (pid, '5 biji', 22.00, NULL, true, 3);
  END IF;

  -- ============================================================
  -- BUAH IMPORT: CERI CHILE
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Ceri Chile', 'ceri-chile', 55.00, 'pack', cat_import, true, false, 23)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '250g',   55.00,  250, true, 1),
      (pid, '500g',   79.00,  500, true, 2),
      (pid, '1kg',   129.00, 1000, true, 3),
      (pid, '2kg',   229.00, 2000, true, 4);
  END IF;

  -- ============================================================
  -- BUAH IMPORT: MELON
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Melon', 'melon', 15.00, 'biji', cat_import, true, false, 24)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 biji',  15.00, NULL, true, 1),
      (pid, '2 biji',  28.00, NULL, true, 2),
      (pid, '4 biji',  52.00, NULL, true, 3),
      (pid, '8 biji',  99.00, NULL, true, 4);
  END IF;

  -- ============================================================
  -- DELIMA: DELIMA INDIA
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Delima India', 'delima-india', 11.00, 'biji', cat_delima, true, false, 1)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 biji',   11.00, NULL, true, 1),
      (pid, '3 biji',   29.00, NULL, true, 2),
      (pid, '5 biji',   40.00, NULL, true, 3),
      (pid, '1 ctn',    69.00, NULL, true, 4),
      (pid, '2 ctn',   129.00, NULL, true, 5),
      (pid, '3 ctn',   189.00, NULL, true, 6);
  END IF;

  -- ============================================================
  -- DELIMA: DELIMA TUNISIA SMALL
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Delima Tunisia Small', 'delima-tunisia-small', 9.90, 'biji', cat_delima, true, false, 2)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 biji',   9.90, NULL, true, 1),
      (pid, '2 biji',  26.00, NULL, true, 2),
      (pid, '3 biji',  33.00, NULL, true, 3),
      (pid, '6 biji',  49.00, NULL, true, 4),
      (pid, '12 biji', 80.00, NULL, true, 5);
  END IF;

  -- ============================================================
  -- DELIMA: DELIMA TUNISIA LARGE
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Delima Tunisia Large', 'delima-tunisia-large', 16.90, 'biji', cat_delima, true, false, 3)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 biji',   16.90, NULL, true, 1),
      (pid, '2 biji',   28.00, NULL, true, 2),
      (pid, '3 biji',   36.00, NULL, true, 3),
      (pid, '6 biji',   59.00, NULL, true, 4),
      (pid, '12 biji',  90.00, NULL, true, 5);
  END IF;

  -- ============================================================
  -- DELIMA: DELIMA TUNISIA JUMBO
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Delima Tunisia Jumbo', 'delima-tunisia-jumbo', 16.90, 'biji', cat_delima, true, false, 4)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 biji',   16.90, NULL, true, 1),
      (pid, '2 biji',   30.00, NULL, true, 2),
      (pid, '3 biji',   42.00, NULL, true, 3),
      (pid, '6 biji',   69.00, NULL, true, 4),
      (pid, '12 biji', 110.00, NULL, true, 5);
  END IF;

  -- ============================================================
  -- DELIMA: JUS DELIMA
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Jus Delima', 'jus-delima', 25.00, 'botol', cat_jus, true, false, 1)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 botol',   25.00, NULL, true, 1),
      (pid, '3 botol',   49.00, NULL, true, 2),
      (pid, '6 botol',   89.00, NULL, true, 3),
      (pid, '12 botol', 159.00, NULL, true, 4),
      (pid, '24 botol', 289.00, NULL, true, 5);
  END IF;

  -- ============================================================
  -- BUAH TEMPATAN: MANGGIS
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Manggis', 'manggis', 9.00, 'pack', cat_tempatan, true, false, 1)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',   9.00,  500, true, 1),
      (pid, '1kg',   15.00, 1000, true, 2),
      (pid, '2kg',   25.00, 2000, true, 3);
  END IF;

  -- ============================================================
  -- BUAH TEMPATAN: RAMBUTAN
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Rambutan', 'rambutan', 9.00, 'pack', cat_tempatan, true, false, 2)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',   9.00,  500, true, 1),
      (pid, '1kg',   15.00, 1000, true, 2),
      (pid, '2kg',   25.00, 2000, true, 3);
  END IF;

  -- ============================================================
  -- BUAH TEMPATAN: DOKONG
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Dokong', 'dokong', 9.00, 'pack', cat_tempatan, true, false, 3)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',   9.00,  500, true, 1),
      (pid, '1kg',   15.00, 1000, true, 2),
      (pid, '2kg',   25.00, 2000, true, 3);
  END IF;

  -- ============================================================
  -- BUAH TEMPATAN: LONGAN JUMBO
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Longan Jumbo', 'longan-jumbo', 13.00, 'pack', cat_tempatan, true, false, 4)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1kg',  13.00, 1000, true, 1),
      (pid, '2kg',  22.00, 2000, true, 2);
  END IF;

  -- ============================================================
  -- BUAH TEMPATAN: JAMBU BATU
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Jambu Batu', 'jambu-batu', 13.00, 'pack', cat_tempatan, true, false, 5)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1kg',  13.00, 1000, true, 1),
      (pid, '2kg',  22.00, 2000, true, 2);
  END IF;

  -- ============================================================
  -- BUAH TEMPATAN: MANGGA FALAN
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Mangga Falan', 'mangga-falan', 13.00, 'pack', cat_tempatan, true, false, 6)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1kg',  13.00, 1000, true, 1),
      (pid, '2kg',  22.00, 2000, true, 2);
  END IF;

  -- ============================================================
  -- BUAH TEMPATAN: BABY NENAS
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Baby Nenas', 'baby-nenas', 13.00, 'pack', cat_tempatan, true, false, 7)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 pack', 13.00, NULL, true, 1),
      (pid, '2 pack', 22.00, NULL, true, 2);
  END IF;

  -- ============================================================
  -- BUAH TEMPATAN: SALAK
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Salak', 'salak', 14.50, 'pack', cat_tempatan, true, false, 8)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1kg',  14.50, 1000, true, 1),
      (pid, '2kg',  22.70, 2000, true, 2);
  END IF;

  -- ============================================================
  -- BUAH TEMPATAN: LIMAU BALI
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Limau Bali', 'limau-bali', 19.00, 'biji', cat_tempatan, true, false, 9)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 biji (1kg+)',   19.00, NULL, true, 1),
      (pid, '2 biji (1kg+)',   47.50, NULL, true, 2),
      (pid, '3 biji (1kg+)',   66.00, NULL, true, 3),
      (pid, '1 biji (1.5kg+)', 32.90, NULL, true, 4),
      (pid, '2 biji (1.5kg+)', 55.50, NULL, true, 5),
      (pid, '3 biji (1.5kg+)', 79.50, NULL, true, 6),
      (pid, '1 biji Baby 600g+', 25.90, NULL, true, 7),
      (pid, '2 biji Baby',     40.90, NULL, true, 8),
      (pid, '3 biji Baby',     56.50, NULL, true, 9);
  END IF;

  -- ============================================================
  -- BUAH TEMPATAN: ISI POMELO
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Isi Pomelo', 'isi-pomelo', 19.00, 'pack', cat_tempatan, true, false, 10)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 pek',  19.00, NULL, true, 1),
      (pid, '2 pek',  45.00, NULL, true, 2),
      (pid, '3 pek',  59.00, NULL, true, 3),
      (pid, '4 pek + 1 jus', 80.00, NULL, true, 4);
  END IF;

  -- ============================================================
  -- KURMA MUDA & SEGAR
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Kurma Muda', 'kurma-muda', 19.00, 'pack', cat_kurma_muda, true, false, 1)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '250g',   19.00,  250, true, 1),
      (pid, '500g',   23.35,  500, true, 2),
      (pid, '1kg',    80.00, 1000, true, 3),
      (pid, '2kg',   140.00, 2000, true, 4),
      (pid, '3kg',    99.00, 3000, true, 5),
      (pid, '5kg',   149.00, 5000, true, 6),
      (pid, '3kg + 1kg Free', 119.00, NULL, true, 7);
  END IF;

  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Libya Fresh Gred 1', 'libya-fresh-gred-1', 69.00, 'pack', cat_kurma_muda, true, false, 2)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1kg',   69.00, 1000, true, 1),
      (pid, '2kg',  109.00, 2000, true, 2),
      (pid, '5kg',  219.00, 5000, true, 3);
  END IF;

  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Libya Fresh Gred 2 (Sweet)', 'libya-fresh-gred-2', 69.00, 'pack', cat_kurma_muda, true, false, 3)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1kg',   69.00, 1000, true, 1),
      (pid, '2kg',  109.00, 2000, true, 2),
      (pid, '5kg',  219.00, 5000, true, 3);
  END IF;

  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Libya Fresh Gred 3 (Semi Dry)', 'libya-fresh-gred-3', 49.00, 'pack', cat_kurma_muda, true, false, 4)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1kg',   49.00, 1000, true, 1),
      (pid, '2kg',   59.00, 2000, true, 2),
      (pid, '5kg',   89.00, 5000, true, 3);
  END IF;

  -- ============================================================
  -- READY TO EAT
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Nenas Potong', 'nenas-potong', 6.00, 'cup', cat_rte, true, false, 1)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 cup (300g)',   6.00, 300, true, 1),
      (pid, '2 cup (600g)',  11.00, 600, true, 2),
      (pid, '3 cup (900g)',  15.00, 900, true, 3);
  END IF;

  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Pulut Santan Durian', 'pulut-santan-durian', 39.00, 'pack', cat_rte, true, false, 2)
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Sweet Potato RTE', 'sweet-potato-rte', 7.00, 'pack', cat_rte, true, true, 3)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 pek',   7.00, NULL, true, 1),
      (pid, '5 pek',  25.00, NULL, true, 2),
      (pid, '10 pek', 46.00, NULL, true, 3);
  END IF;

  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Grilled Corn RTE', 'grilled-corn-rte', 7.00, 'pack', cat_rte, true, true, 4)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 pek',   7.00, NULL, true, 1),
      (pid, '5 pek',  25.00, NULL, true, 2),
      (pid, '10 pek', 46.00, NULL, true, 3);
  END IF;

  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('Honey Sweet Potato', 'honey-sweet-potato', 13.00, 'pack', cat_rte, true, true, 5)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 pek',  13.00, NULL, true, 1),
      (pid, '2 pek',  22.00, NULL, true, 2),
      (pid, '3 pek',  30.00, NULL, true, 3);
  END IF;

  -- ============================================================
  -- GIFT BOX & SET
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('FRUITBOX SET GWS (A)', 'fruitbox-set-gws-a', 119.00, 'kotak', cat_giftbox, true, false, 1)
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO products (name, slug, price, unit, category_id, is_active, is_shippable, sort_order)
  VALUES ('FRUITBOX SET GWS (B)', 'fruitbox-set-gws-b', 59.00, 'kotak', cat_giftbox, true, false, 2)
  ON CONFLICT (slug) DO NOTHING;

END $$;
