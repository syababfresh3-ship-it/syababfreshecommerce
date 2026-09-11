-- ============================================================
-- 127_product_images.sql — galeri gambar produk (audit §Sprint 3C, PDP)
--
-- Dulu halaman produk tunjuk SATU `products.image_url` sahaja; `products.images
-- text[]` (3 slot tetap di borang admin) tak pernah dipaparkan. Kini jadual
-- berasingan dengan susunan (sort_order) + alt text, diurus di borang admin.
-- `products.image_url` KEKAL sebagai gambar utama (kad katalog, OG image);
-- baris di sini = gambar tambahan yang dipapar selepasnya di galeri PDP.
--
-- Backfill: `products.images` lama disalin masuk sekali (hanya produk yang
-- belum ada baris) — URL sama dengan image_url dilangkau supaya tak berganda.
-- Akses: awam boleh baca (gambar memang awam); admin penuh (is_admin).
-- Idempotent — selamat dijalankan semula.
-- ============================================================

create table if not exists public.product_images (
  id         uuid        primary key default gen_random_uuid(),
  product_id uuid        not null references public.products(id) on delete cascade,
  url        text        not null,
  alt        text,
  sort_order int         not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_product_images_product_sort
  on public.product_images (product_id, sort_order);

alter table public.product_images enable row level security;

drop policy if exists "Public read" on public.product_images;
create policy "Public read" on public.product_images
  for select
  using (true);

drop policy if exists "Admin full access" on public.product_images;
create policy "Admin full access" on public.product_images
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Backfill dari products.images (array lama) — sekali sahaja per produk.
insert into public.product_images (product_id, url, sort_order)
select p.id, u.url, (u.ord - 1)::int
from public.products p
cross join lateral unnest(p.images) with ordinality as u(url, ord)
where p.images is not null
  and u.url is not null
  and u.url <> ''
  and u.url is distinct from p.image_url
  and not exists (select 1 from public.product_images x where x.product_id = p.id);
