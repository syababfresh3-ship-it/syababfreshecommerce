-- ============================================================
-- 035_products_seed.sql
-- Seed produk SyababFresh untuk website e-commerce
-- Harga cadangan website (sama dengan TikTok — margin lebih baik tanpa komisyen platform)
-- ============================================================

-- Pastikan kategori wujud dulu
INSERT INTO categories (name, slug, sort_order) VALUES
  ('Kurma Ajwa', 'kurma-ajwa', 1),
  ('Kurma Mariami', 'kurma-mariami', 2),
  ('Kurma Safawi', 'kurma-safawi', 3),
  ('Kurma Medjoul', 'kurma-medjoul', 4),
  ('Kurma Sukkari', 'kurma-sukkari', 5),
  ('Kurma Lain-lain', 'kurma-lain-lain', 6),
  ('Kurma Set & Bundle', 'kurma-set-bundle', 7),
  ('Buah Kering', 'buah-kering', 8),
  ('Kismis', 'kismis', 9),
  ('Kacang', 'kacang', 10),
  ('Serunding', 'serunding', 11),
  ('Lain-lain', 'lain-lain', 12)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- HELPER: fungsi untuk insert produk + variants sekaligus
-- ============================================================

DO $$
DECLARE
  -- Category IDs
  cat_ajwa       uuid;
  cat_mariami    uuid;
  cat_safawi     uuid;
  cat_medjoul    uuid;
  cat_sukkari    uuid;
  cat_kurma_lain uuid;
  cat_bundle     uuid;
  cat_buah_kering uuid;
  cat_kismis     uuid;
  cat_kacang     uuid;
  cat_serunding  uuid;
  cat_lain       uuid;

  -- Product ID placeholder
  pid uuid;

BEGIN

  SELECT id INTO cat_ajwa       FROM categories WHERE slug = 'kurma-ajwa';
  SELECT id INTO cat_mariami    FROM categories WHERE slug = 'kurma-mariami';
  SELECT id INTO cat_safawi     FROM categories WHERE slug = 'kurma-safawi';
  SELECT id INTO cat_medjoul    FROM categories WHERE slug = 'kurma-medjoul';
  SELECT id INTO cat_sukkari    FROM categories WHERE slug = 'kurma-sukkari';
  SELECT id INTO cat_kurma_lain FROM categories WHERE slug = 'kurma-lain-lain';
  SELECT id INTO cat_bundle     FROM categories WHERE slug = 'kurma-set-bundle';
  SELECT id INTO cat_buah_kering FROM categories WHERE slug = 'buah-kering';
  SELECT id INTO cat_kismis     FROM categories WHERE slug = 'kismis';
  SELECT id INTO cat_kacang     FROM categories WHERE slug = 'kacang';
  SELECT id INTO cat_serunding  FROM categories WHERE slug = 'serunding';
  SELECT id INTO cat_lain       FROM categories WHERE slug = 'lain-lain';

  -- ============================================================
  -- KURMA AJWA MEDIUM
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('AJWA Medium', 'ajwa-medium', 12.00, 'pack', cat_ajwa, true, 1)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',    12.00,   100, true, 1),
      (pid, '300g',    21.00,   300, true, 2),
      (pid, '500g',    29.00,   500, true, 3),
      (pid, '1kg',     30.00,  1000, true, 4),
      (pid, '2kg',     79.00,  2000, true, 5),
      (pid, '5kg/ctn',199.00,  5000, true, 6);
  END IF;

  -- ============================================================
  -- KURMA AJWA ALIYAH MIX
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('AJWA Aliyah Mix', 'ajwa-aliyah-mix', 13.00, 'pack', cat_ajwa, true, 2)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',    13.00,   100, true, 1),
      (pid, '300g',    23.00,   300, true, 2),
      (pid, '500g',    35.00,   500, true, 3),
      (pid, '1kg',     49.00,  1000, true, 4),
      (pid, '2kg',    109.00,  2000, true, 5),
      (pid, '5kg/ctn',239.00,  5000, true, 6);
  END IF;

  -- ============================================================
  -- KURMA AJWA LARGE
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('AJWA Large', 'ajwa-large', 14.00, 'pack', cat_ajwa, true, 3)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',    14.00,   100, true, 1),
      (pid, '300g',    27.00,   300, true, 2),
      (pid, '500g',    43.00,   500, true, 3),
      (pid, '1kg',     69.00,  1000, true, 4),
      (pid, '2kg',    129.00,  2000, true, 5),
      (pid, '5kg/ctn',249.00,  5000, true, 6);
  END IF;

  -- ============================================================
  -- KURMA AJWA JUMBO
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('AJWA Jumbo', 'ajwa-jumbo', 15.00, 'pack', cat_ajwa, true, 4)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',    15.00,   100, true, 1),
      (pid, '300g',    29.00,   300, true, 2),
      (pid, '500g',    49.00,   500, true, 3),
      (pid, '1kg',     79.00,  1000, true, 4),
      (pid, '2kg',    150.00,  2000, true, 5),
      (pid, '5kg/ctn',269.00,  5000, true, 6);
  END IF;

  -- ============================================================
  -- KURMA AJWA SUPER JUMBO VIP
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('AJWA Super Jumbo VIP', 'ajwa-super-jumbo-vip', 16.00, 'pack', cat_ajwa, true, 5)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',    16.00,   100, true, 1),
      (pid, '300g',    31.00,   300, true, 2),
      (pid, '500g',    49.00,   500, true, 3),
      (pid, '1kg',     89.00,  1000, true, 4),
      (pid, '2kg',    139.00,  2000, true, 5),
      (pid, '5kg/ctn',309.00,  5000, true, 6);
  END IF;

  -- ============================================================
  -- KURMA MARIAMI AAA
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('MARIAMI AAA', 'mariami-aaa', 13.00, 'pack', cat_mariami, true, 1)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',    13.00,   100, true, 1),
      (pid, '300g',    25.00,   300, true, 2),
      (pid, '500g',    32.00,   500, true, 3),
      (pid, '1kg',     55.00,  1000, true, 4),
      (pid, '2kg',     99.00,  2000, true, 5),
      (pid, '5kg/ctn',239.00,  5000, true, 6);
  END IF;

  -- ============================================================
  -- KURMA MARIAMI AA
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Mariami AA', 'mariami-aa', 12.00, 'pack', cat_mariami, true, 2)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',    12.00,   100, true, 1),
      (pid, '300g',    19.00,   300, true, 2),
      (pid, '500g',    27.00,   500, true, 3),
      (pid, '1kg',     45.00,  1000, true, 4),
      (pid, '2kg',     85.00,  2000, true, 5),
      (pid, '5kg/ctn',185.00,  5000, true, 6);
  END IF;

  -- ============================================================
  -- KURMA MARIAMI A
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('MARIAMI A', 'mariami-a', 13.00, 'pack', cat_mariami, true, 3)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',    13.00,   100, true, 1),
      (pid, '300g',    19.00,   300, true, 2),
      (pid, '500g',    27.00,   500, true, 3),
      (pid, '1kg',     29.00,  1000, true, 4),
      (pid, '2kg',     75.00,  2000, true, 5),
      (pid, '5kg/ctn',179.00,  5000, true, 6);
  END IF;

  -- ============================================================
  -- KURMA MARIAMI PREMIUM TRD
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('MARIAMI Premium (Kotak)', 'mariami-premium-kotak', 25.00, 'pack', cat_mariami, true, 4)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '250g', 25.00, 250, true, 1),
      (pid, '500g', 35.00, 500, true, 2);
  END IF;

  -- ============================================================
  -- KURMA SAFAWI JUMBO
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('SAFAWI Jumbo', 'safawi-jumbo', 13.00, 'pack', cat_safawi, true, 1)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',    13.00,   100, true, 1),
      (pid, '300g',    20.00,   300, true, 2),
      (pid, '500g',    30.00,   500, true, 3),
      (pid, '1kg',     55.00,  1000, true, 4),
      (pid, '2kg',     99.00,  2000, true, 5),
      (pid, '5kg',    229.00,  5000, true, 6);
  END IF;

  -- ============================================================
  -- KURMA SAFAWI LARGE
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('SAFAWI Large', 'safawi-large', 12.00, 'pack', cat_safawi, true, 2)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',    12.00,   100, true, 1),
      (pid, '300g',    19.00,   300, true, 2),
      (pid, '500g',    27.00,   500, true, 3),
      (pid, '1kg',     39.00,  1000, true, 4),
      (pid, '2kg',     89.00,  2000, true, 5),
      (pid, '5kg',    209.00,  5000, true, 6);
  END IF;

  -- ============================================================
  -- KURMA SAFAWI MEDIUM
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('SAFAWI Medium', 'safawi-medium', 11.00, 'pack', cat_safawi, true, 3)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',    11.00,   100, true, 1),
      (pid, '300g',    18.00,   300, true, 2),
      (pid, '500g',    29.00,   500, true, 3),
      (pid, '1kg',     35.00,  1000, true, 4),
      (pid, '2kg',     75.00,  2000, true, 5),
      (pid, '5kg',    169.00,  5000, true, 6);
  END IF;

  -- ============================================================
  -- SAFAWI PREMIUM TRD
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('SAFAWI Jumbo Premium (Kotak)', 'safawi-jumbo-premium-kotak', 25.00, 'pack', cat_safawi, true, 4)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '250g', 25.00, 250, true, 1),
      (pid, '500g', 35.00, 500, true, 2);
  END IF;

  -- ============================================================
  -- MEDJOUL PALESTINE SUPER JUMBO
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('MEDJOUL Palestine Super Jumbo', 'medjoul-palestine-super-jumbo', 17.00, 'pack', cat_medjoul, true, 1)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',    17.00,   100, true, 1),
      (pid, '500g',    59.00,   500, true, 2),
      (pid, '1kg',     99.00,  1000, true, 3),
      (pid, '2kg',    169.00,  2000, true, 4),
      (pid, '5kg',    390.00,  5000, true, 5);
  END IF;

  -- ============================================================
  -- MEDJOUL PALESTINE JUMBO
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('MEDJOUL Palestine Jumbo', 'medjoul-palestine-jumbo', 16.00, 'pack', cat_medjoul, true, 2)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',    16.00,   100, true, 1),
      (pid, '500g',    55.00,   500, true, 2),
      (pid, '1kg',     89.00,  1000, true, 3),
      (pid, '2kg',    159.00,  2000, true, 4),
      (pid, '5kg',    350.00,  5000, true, 5);
  END IF;

  -- ============================================================
  -- MEDJOUL PALESTINE LARGE
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('MEDJOUL Palestine Large', 'medjoul-palestine-large', 15.00, 'pack', cat_medjoul, true, 3)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',    15.00,   100, true, 1),
      (pid, '300g',    35.00,   300, true, 2),
      (pid, '500g',    49.00,   500, true, 3),
      (pid, '1kg',     79.00,  1000, true, 4),
      (pid, '2kg',    149.00,  2000, true, 5),
      (pid, '5kg',    315.00,  5000, true, 6);
  END IF;

  -- ============================================================
  -- DRY SUKKARI
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('DRY SUKKARI', 'dry-sukkari', 14.00, 'pack', cat_sukkari, true, 1)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',    14.00,   100, true, 1),
      (pid, '500g',    29.00,   500, true, 2),
      (pid, '1kg',     45.00,  1000, true, 3),
      (pid, '2kg',     89.00,  2000, true, 4),
      (pid, '3kg/ctn',109.00,  3000, true, 5);
  END IF;

  -- ============================================================
  -- ROTAB SUKKARI
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('ROTAB SUKKARI', 'rotab-sukkari', 12.00, 'pack', cat_sukkari, true, 2)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',    12.00,   100, true, 1),
      (pid, '500g',    25.00,   500, true, 2),
      (pid, '1kg',     40.00,  1000, true, 3),
      (pid, '2kg',     75.00,  2000, true, 4),
      (pid, '3kg/ctn', 89.00,  3000, true, 5);
  END IF;

  -- ============================================================
  -- KURMA LIBYA GRED 1
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Kurma Libya Gred 1', 'kurma-libya-gred-1', 15.00, 'pack', cat_kurma_lain, true, 1)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',  15.00,  500, true, 1),
      (pid, '1kg',   29.00, 1000, true, 2),
      (pid, '2kg',   39.00, 2000, true, 3),
      (pid, '5kg',   89.00, 5000, true, 4);
  END IF;

  -- ============================================================
  -- KURMA LIBYA / ALGERIA
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Kurma Libya/Algeria', 'kurma-libya-algeria', 11.00, 'pack', cat_kurma_lain, true, 2)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',    11.00,   100, true, 1),
      (pid, '300g',     9.00,   300, true, 2),
      (pid, '500g',    12.00,   500, true, 3),
      (pid, '1kg',     23.00,  1000, true, 4),
      (pid, '2kg',     45.00,  2000, true, 5),
      (pid, '5kg/ctn', 90.00,  5000, true, 6);
  END IF;

  -- ============================================================
  -- KURMA TUNISIA
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Kurma Tunisia', 'kurma-tunisia', 12.00, 'pack', cat_kurma_lain, true, 3)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',    12.00,   100, true, 1),
      (pid, '300g',    17.00,   300, true, 2),
      (pid, '500g',    22.00,   500, true, 3),
      (pid, '1kg',     29.90,  1000, true, 4),
      (pid, '2kg',     50.00,  2000, true, 5),
      (pid, '5kg/ctn', 95.00,  5000, true, 6);
  END IF;

  -- ============================================================
  -- MABROOM
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('MABROOM', 'mabroom', 39.00, 'pack', cat_kurma_lain, true, 4)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',     39.00,  500, true, 1),
      (pid, '1kg',      69.00, 1000, true, 2),
      (pid, '5kg/ctn', 299.00, 5000, true, 3);
  END IF;

  -- ============================================================
  -- KURMA SEJUK BEKU
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Kurma Sejuk Beku', 'kurma-sejuk-beku', 25.00, 'pack', cat_kurma_lain, true, 5)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',   25.00,  500, true, 1),
      (pid, '1kg',    35.00, 1000, true, 2),
      (pid, '10kg',  115.00,10000, true, 3);
  END IF;

  -- ============================================================
  -- TANGKAI TUNISIA
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Tangkai Tunisia', 'tangkai-tunisia', 15.00, 'pack', cat_kurma_lain, true, 6)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '400g', 15.00,  400, true, 1),
      (pid, '500g', 16.00,  500, true, 2);
  END IF;

  -- ============================================================
  -- ROTAB RAWDA ALMADINAH
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Rotab Rawda Almadinah', 'rotab-rawda-almadinah', 16.00, 'pack', cat_kurma_lain, true, 7)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 pack',   16.00,  NULL, true, 1),
      (pid, '3 pack',   39.00,  NULL, true, 2),
      (pid, '6 pack',   60.00,  NULL, true, 3),
      (pid, '12 pack',  99.00,  NULL, true, 4);
  END IF;

  -- ============================================================
  -- ROTAB BLACK RUBBIES
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('ROTAB Black Rubbies', 'rotab-black-rubbies', 17.00, 'pack', cat_kurma_lain, true, 8)
  ON CONFLICT (slug) DO NOTHING;

  -- ============================================================
  -- ROTAB FATIMAH
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('ROTAB Fatimah', 'rotab-fatimah', 17.00, 'pack', cat_kurma_lain, true, 9)
  ON CONFLICT (slug) DO NOTHING;

  -- ============================================================
  -- ROTAB ALMADHINAH
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('ROTAB Almadhinah', 'rotab-almadhinah', 18.00, 'pack', cat_kurma_lain, true, 10)
  ON CONFLICT (slug) DO NOTHING;

  -- ============================================================
  -- KURMA SET: KURMA 3 SAHABAT
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Kurma 3 Sahabat', 'kurma-3-sahabat', 49.00, 'set', cat_bundle, true, 1)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 Set (3 Botol)',  49.00,  NULL, true, 1),
      (pid, '2 Set (6 Botol)',  95.00,  NULL, true, 2),
      (pid, '3 Set (9 Botol)', 139.00,  NULL, true, 3);
  END IF;

  -- ============================================================
  -- KURMA SET: KURMA 4 BERADIK
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Kurma 4 Beradik', 'kurma-4-beradik', 79.00, 'set', cat_bundle, true, 2)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 Set (3 Botol)',   79.00, NULL, true, 1),
      (pid, '2 Set (6 Botol)',  149.00, NULL, true, 2),
      (pid, '3 Set (9 Botol)', 209.00, NULL, true, 3);
  END IF;

  -- ============================================================
  -- KURMA SET: KURMA KEMBAR 3
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Kurma Kembar 3', 'kurma-kembar-3', 49.00, 'set', cat_bundle, true, 3)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, 'Ajwa',            55.00, NULL, true, 1),
      (pid, 'Mariami',         59.00, NULL, true, 2),
      (pid, 'Safawi',          49.00, NULL, true, 3),
      (pid, 'Medjoul',         85.00, NULL, true, 4),
      (pid, 'Ajwa Mix Aliyah', 59.00, NULL, true, 5);
  END IF;

  -- ============================================================
  -- KURMA 4 MAMS NSR
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Kurma 4 MAMS NSR 1kg', 'kurma-4-mams-nsr', 79.00, 'pack', cat_bundle, true, 4)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '1 pack',   79.00, 1000, true, 1),
      (pid, '2 pack',  149.00, 2000, true, 2),
      (pid, '3 pack',  209.00, 3000, true, 3);
  END IF;

  -- ============================================================
  -- AJWA PACK: AJWA 300G x 3
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Ajwa 300g Pack', 'ajwa-300g-pack', 49.00, 'set', cat_bundle, true, 5)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '3 Botol (x3)',           49.00, NULL, true, 1),
      (pid, '3 Botol + 1 Free (x4)',  59.00, NULL, true, 2);
  END IF;

  -- ============================================================
  -- BUAH KERING: DRY TIN (BUAH TIN)
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Buah Tin Kering', 'buah-tin-kering', 15.00, 'pack', cat_buah_kering, true, 1)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',  15.00,  100, true, 1),
      (pid, '500g',  35.00,  500, true, 2),
      (pid, '1kg',   59.00, 1000, true, 3);
  END IF;

  -- ============================================================
  -- BUAH KERING: DRY APRICOT
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Aprikot Kering', 'aprikot-kering', 15.00, 'pack', cat_buah_kering, true, 2)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',  15.00,  100, true, 1),
      (pid, '500g',  35.00,  500, true, 2),
      (pid, '1kg',   59.00, 1000, true, 3);
  END IF;

  -- ============================================================
  -- BUAH KERING: DRY KIWI
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Kiwi Kering', 'kiwi-kering', 13.00, 'pack', cat_buah_kering, true, 3)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',  13.00,  100, true, 1),
      (pid, '500g',  25.00,  500, true, 2),
      (pid, '1kg',   45.00, 1000, true, 3);
  END IF;

  -- ============================================================
  -- BUAH KERING: PRUNE
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Prune (Plum Kering)', 'prune-plum-kering', 13.00, 'pack', cat_buah_kering, true, 4)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',  13.00,  100, true, 1),
      (pid, '500g',  29.00,  500, true, 2),
      (pid, '1kg',   49.00, 1000, true, 3);
  END IF;

  -- ============================================================
  -- KISMIS: KISMIS GOLDEN JUMBO
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Kismis Golden Jumbo', 'kismis-golden-jumbo', 13.00, 'pack', cat_kismis, true, 1)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',  13.00,  100, true, 1),
      (pid, '500g',  35.00,  500, true, 2),
      (pid, '1kg',   55.00, 1000, true, 3);
  END IF;

  -- ============================================================
  -- KISMIS: KISMIS BLACK JUMBO
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Kismis Black Jumbo', 'kismis-black-jumbo', 12.00, 'pack', cat_kismis, true, 2)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',  12.00,  100, true, 1),
      (pid, '500g',  35.00,  500, true, 2),
      (pid, '1kg',   55.00, 1000, true, 3);
  END IF;

  -- ============================================================
  -- KISMIS: KISMIS GOLDEN SMALL
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Kismis Golden', 'kismis-golden', 12.00, 'pack', cat_kismis, true, 3)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',  12.00,  100, true, 1),
      (pid, '500g',  29.00,  500, true, 2),
      (pid, '1kg',   39.00, 1000, true, 3);
  END IF;

  -- ============================================================
  -- KISMIS: KISMIS SULTANA
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Kismis Sultana', 'kismis-sultana', 17.00, 'pack', cat_kismis, true, 4)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '500g',  17.00,  500, true, 1),
      (pid, '1kg',   29.00, 1000, true, 2);
  END IF;

  -- ============================================================
  -- KACANG: PISTACHIO
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Pistachio', 'pistachio', 15.00, 'pack', cat_kacang, true, 1)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',  15.00,  100, true, 1),
      (pid, '500g',  45.00,  500, true, 2),
      (pid, '1kg',   79.00, 1000, true, 3);
  END IF;

  -- ============================================================
  -- KACANG: GAJUS (CASHEW)
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Gajus (Cashew)', 'gajus-cashew', 15.00, 'pack', cat_kacang, true, 2)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',  15.00,  100, true, 1),
      (pid, '500g',  45.00,  500, true, 2),
      (pid, '1kg',   79.00, 1000, true, 3);
  END IF;

  -- ============================================================
  -- KACANG: ALMOND
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Almond', 'almond', 14.00, 'pack', cat_kacang, true, 3)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',  14.00,  100, true, 1),
      (pid, '500g',  39.00,  500, true, 2),
      (pid, '1kg',   69.00, 1000, true, 3);
  END IF;

  -- ============================================================
  -- KACANG: ROASTED CASHEW WITH SKIN
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Roasted Cashew With Skin', 'roasted-cashew-with-skin', 15.00, 'pack', cat_kacang, true, 4)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',  15.00,  100, true, 1),
      (pid, '500g',  45.00,  500, true, 2),
      (pid, '1kg',   79.00, 1000, true, 3);
  END IF;

  -- ============================================================
  -- KACANG: PEANUT CANDY
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Gula-gula Kacang (Peanut Candy)', 'peanut-candy', 12.00, 'pack', cat_kacang, true, 5)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '100g',  12.00,  100, true, 1),
      (pid, '400g',  25.00,  400, true, 2),
      (pid, '800g',  39.00,  800, true, 3);
  END IF;

  -- ============================================================
  -- SERUNDING: SERUNDING IKAN
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Serunding Ikan', 'serunding-ikan', 24.00, 'pack', cat_serunding, true, 1)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '200g',  24.00,  200, true, 1),
      (pid, '400g',  39.00,  400, true, 2),
      (pid, '800g',  69.00,  800, true, 3),
      (pid, '1kg',   79.00, 1000, true, 4);
  END IF;

  -- ============================================================
  -- SERUNDING: SERUNDING DAGING
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Serunding Daging', 'serunding-daging', 27.00, 'pack', cat_serunding, true, 2)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '200g',  27.00,  200, true, 1),
      (pid, '400g',  49.00,  400, true, 2),
      (pid, '800g',  79.00,  800, true, 3),
      (pid, '1kg',   89.00, 1000, true, 4);
  END IF;

  -- ============================================================
  -- SERUNDING: SERUNDING AYAM
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Serunding Ayam', 'serunding-ayam', 27.00, 'pack', cat_serunding, true, 3)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '200g',  27.00,  200, true, 1),
      (pid, '400g',  49.00,  400, true, 2),
      (pid, '800g',  79.00,  800, true, 3),
      (pid, '1kg',   89.00, 1000, true, 4);
  END IF;

  -- ============================================================
  -- LAIN-LAIN: COKLAT AZERBAIJAN
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Coklat Azerbaijan', 'coklat-azerbaijan', 19.00, 'pack', cat_lain, true, 1)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '200g',  19.00,  200, true, 1),
      (pid, '500g',  39.00,  500, true, 2),
      (pid, '1kg',   59.00, 1000, true, 3);
  END IF;

  -- ============================================================
  -- LAIN-LAIN: MADU AKASIA + KAMQUAT
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('Madu Akasia + Kamquat', 'madu-akasia-kamquat', 59.00, 'set', cat_lain, true, 2)
  ON CONFLICT (slug) DO NOTHING;

  -- ============================================================
  -- LAIN-LAIN: AJWA ALIYAH PREMIUM (KOTAK)
  -- ============================================================
  INSERT INTO products (name, slug, price, unit, category_id, is_active, sort_order)
  VALUES ('AJWA Aliyah Premium (Kotak)', 'ajwa-aliyah-premium-kotak', 28.00, 'pack', cat_ajwa, true, 6)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO pid;

  IF pid IS NOT NULL THEN
    INSERT INTO product_variants (product_id, name, price, weight_grams, is_active, sort_order) VALUES
      (pid, '250g', 28.00, 250, true, 1),
      (pid, '500g', 39.00, 500, true, 2);
  END IF;

END $$;
