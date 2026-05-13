-- ============================================================
-- 046_fix_shippable.sql
-- Set is_shippable ikut jenis produk:
-- Kurma + Buah Kering = nationwide (pos biasa)
-- Buah Segar = Klang Valley sahaja (penghantaran sejuk)
-- ============================================================

-- 1. Reset semua → boleh dipos (default)
update public.products set is_shippable = true;

-- 2. Buah Segar → TIDAK boleh dipos luar KV
--    Covers: parent 'buah-segar' + semua sub-kategori
--    (durian, durian-frozen, harumanis, buah-import, buah-tempatan, delima)
update public.products
set is_shippable = false
where category_id in (
  select id from public.categories
  where slug = 'buah-segar'
     or parent_id = (select id from public.categories where slug = 'buah-segar')
);

-- Verify:
-- select c.name, p.name, p.is_shippable
-- from products p join categories c on c.id = p.category_id
-- order by p.is_shippable, c.name;
