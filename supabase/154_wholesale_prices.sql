-- ============================================================
-- 154_wholesale_prices.sql
-- Harga borong LALAI per produk/saiz (terpakai untuk SEMUA pelanggan borong) — diurus di
-- /admin/resellers ("Borong" → Harga borong lalai). Harga khas per pelanggan (reseller_prices,
-- migration 067) kekal sebagai PENGECUALIAN: Quick Order guna urutan
--   harga khas pelanggan → harga borong lalai → harga runcit.
-- Bentuk sama seperti reseller_prices supaya kod lookup serupa. ADDITIVE. Idempotent.
-- ============================================================
create table if not exists public.wholesale_prices (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  variant_id  uuid references public.product_variants(id) on delete cascade,   -- null = harga produk asas (tanpa saiz)
  price       numeric not null check (price >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);
comment on table public.wholesale_prices is 'Harga borong lalai per produk/saiz untuk semua pelanggan borong (Quick Order mod Borong). Pengecualian per pelanggan: reseller_prices.';
-- Satu harga per (produk, saiz); coalesce sebab NULL != NULL dalam unique biasa.
create unique index if not exists wholesale_prices_unq
  on public.wholesale_prices (product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.wholesale_prices enable row level security;
drop policy if exists wholesale_prices_admin on public.wholesale_prices;
create policy wholesale_prices_admin on public.wholesale_prices
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
