-- ============================================================
-- 130_ad_spend.sql — perbelanjaan iklan (audit §4 ROAS, Sprint 3 fasa 2)
--
-- Dulu P&L guna "Marketing (peruntukan)" per order; tiada ROAS/CAC ikut
-- kempen. Order LP bawa `source` seperti "fb/52520982596515" (id kempen
-- Meta dari utm/ctwa) — jadi spend boleh dipadankan ikut campaign_id.
-- Entri manual dahulu (Admin > Marketing > Ad Spend); import Meta kemudian.
-- Akses: admin sahaja (RLS is_admin). Idempotent.
-- ============================================================

create table if not exists public.ad_spend (
  id            uuid          primary key default gen_random_uuid(),
  spend_date    date          not null,
  channel       text          not null check (channel in ('meta', 'tiktok', 'google', 'other')),
  campaign_id   text,                        -- cth 52520982596515 (padan hujung `source` order LP)
  campaign_name text,
  lp_slug       text,                        -- pilihan: pautkan terus ke satu landing page
  amount        numeric(10,2) not null check (amount >= 0),
  notes         text,
  created_by    uuid          references public.profiles(id) on delete set null,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now()
);

create index if not exists idx_ad_spend_date     on public.ad_spend (spend_date desc);
create index if not exists idx_ad_spend_campaign on public.ad_spend (campaign_id) where campaign_id is not null;
-- Satu baris per hari per kempen (baris tanpa campaign_id bebas)
create unique index if not exists ad_spend_day_campaign_uq
  on public.ad_spend (spend_date, channel, campaign_id) where campaign_id is not null;

alter table public.ad_spend enable row level security;
drop policy if exists "Admin full access" on public.ad_spend;
create policy "Admin full access" on public.ad_spend
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
