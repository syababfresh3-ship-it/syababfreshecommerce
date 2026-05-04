-- ============================================================
-- 037_category_hierarchy.sql
-- Tambah parent_id pada categories untuk hierarki 2-level
-- ============================================================

-- 1. Tambah column parent_id
alter table public.categories
  add column if not exists parent_id uuid references public.categories(id) on delete set null;

-- 2. Tambah index untuk query sub-kategori
create index if not exists idx_categories_parent_id on public.categories(parent_id);

-- 3. Insert 5 parent categories
insert into public.categories (name, slug, description, sort_order, is_active) values
  ('Kurma',                'kurma',               'Semua jenis kurma premium',           0,  true),
  ('Buah Segar',           'buah-segar',          'Buah-buahan segar pelbagai jenis',    10, true),
  ('Buah Kering & Kacang', 'buah-kering-kacang',  'Buah kering, kismis dan kacang',      20, true),
  ('Makanan & Minuman',    'makanan-minuman',     'Serunding, jus dan makanan siap',     30, true),
  ('Gift Box',             'gift-box',            'Hadiah istimewa dalam kotak cantik',  40, true)
on conflict (slug) do nothing;

-- 4. Assign parent_id: Kurma
update public.categories
  set parent_id = (select id from public.categories where slug = 'kurma')
where slug in (
  'kurma-ajwa', 'kurma-mariami', 'kurma-safawi', 'kurma-medjoul',
  'kurma-sukkari', 'kurma-lain-lain', 'kurma-set-bundle', 'kurma-muda-segar'
);

-- 5. Assign parent_id: Buah Segar
update public.categories
  set parent_id = (select id from public.categories where slug = 'buah-segar')
where slug in (
  'durian', 'durian-frozen', 'harumanis', 'buah-import', 'buah-tempatan', 'delima'
);

-- 6. Assign parent_id: Buah Kering & Kacang
update public.categories
  set parent_id = (select id from public.categories where slug = 'buah-kering-kacang')
where slug in ('buah-kering', 'kismis', 'kacang');

-- 7. Assign parent_id: Makanan & Minuman
update public.categories
  set parent_id = (select id from public.categories where slug = 'makanan-minuman')
where slug in ('serunding', 'jus-minuman', 'ready-to-eat', 'lain-lain');

-- 8. Assign parent_id: Gift Box
update public.categories
  set parent_id = (select id from public.categories where slug = 'gift-box')
where slug in ('gift-box-set');
