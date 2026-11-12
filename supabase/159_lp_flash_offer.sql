-- ============================================================
-- 159_lp_flash_offer.sql
-- Tawaran masa terhad ("flash offer") per landing page — permintaan team sales (Hasbi) 11 Nov 2026,
-- diluluskan pemilik 12 Nov: mod A (per pelawat: timer N minit dari kunjungan pertama, boleh dapat
-- semula selepas cooldown) + mod B (berjadual: tarikh/masa mula–tamat, sama untuk semua).
--
-- Prinsip JUJUR: diskaun benar-benar tamat (dikuatkuasa di /api/lp/[slug]/order, bukan JS sahaja),
-- copy LP sebut "tawaran untuk anda · sekali setiap N jam", dan tuntutan direkod ikut telefon
-- supaya clear-cookie/incognito tak boleh tuntut semula dalam tempoh cooldown.
--
-- ADDITIVE & idempotent. LP tanpa flash_offer (null) berkelakuan sama seperti sekarang.
-- ============================================================

-- Tetapan per LP (bentuk: lib/lp-flash.ts FlashOffer)
alter table public.landing_pages add column if not exists flash_offer jsonb;
comment on column public.landing_pages.flash_offer is
  'Tawaran masa terhad: {enabled, mode: visitor|scheduled, discount_type: fixed|percent, amount, window_minutes, cooldown_hours, starts_at, ends_at, min_subtotal, label}. null = tiada.';

-- Tuntutan (mod per pelawat): satu baris setiap order yang dapat diskaun; semakan cooldown ikut telefon.
create table if not exists public.lp_flash_claims (
  id          uuid primary key default gen_random_uuid(),
  page_id     uuid not null references public.landing_pages(id) on delete cascade,
  phone       text not null,                     -- digit sahaja (dinormalkan di pelayan)
  order_id    uuid references public.lp_guest_orders(id) on delete set null,
  discount    numeric not null default 0,
  claimed_at  timestamptz not null default now()
);
comment on table public.lp_flash_claims is 'Tuntutan tawaran masa terhad LP (mod per pelawat) — kuat kuasa cooldown ikut telefon.';
create index if not exists lp_flash_claims_page_phone_idx on public.lp_flash_claims (page_id, phone, claimed_at desc);

alter table public.lp_flash_claims enable row level security;
drop policy if exists lp_flash_claims_admin on public.lp_flash_claims;
create policy lp_flash_claims_admin on public.lp_flash_claims
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
-- Pelayan tulis/baca melalui service role (pintas RLS) — tiada polisi awam.

-- Laporan: diskaun flash disimpan berasingan (jumlah `discount` sedia ada = promo + flash supaya paparan admin lama kekal betul)
alter table public.lp_guest_orders add column if not exists flash_discount numeric not null default 0;
