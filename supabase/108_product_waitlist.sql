-- ============================================================
-- 108_product_waitlist.sql
-- Waitlist "Bagitahu bila ada" — customer daftar minat pada produk habis
-- stok / pre-order. Bila restock, admin salin senarai → Blast (Rasmi).
-- Tag Ceri-waitlist yang selama ni manual jadi automatik.
-- Akses: service-role sahaja (insert via API rate-limited; RLS deny-all).
-- ADDITIVE. Idempotent. Run di Supabase SQL Editor.
-- ============================================================

create table if not exists public.product_waitlist (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products(id) on delete cascade,
  phone        text not null,              -- normalized 60xxxxxxxxx
  name         text,
  user_id      uuid references public.profiles(id) on delete set null,
  notified_at  timestamptz,                -- diisi bila admin tanda "dah dimaklum"
  created_at   timestamptz not null default now(),
  unique (product_id, phone)
);

create index if not exists idx_product_waitlist_product
  on public.product_waitlist (product_id, notified_at);

alter table public.product_waitlist enable row level security;
-- Tiada policy = deny-all; semua akses ikut service role (API kita).
