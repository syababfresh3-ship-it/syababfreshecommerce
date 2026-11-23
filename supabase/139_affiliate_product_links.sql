-- ============================================================
-- 139_affiliate_product_links.sql — Affiliate produk-link (Model C+B) (1 Okt 2026)
--
-- Program affiliate BARU: affiliate kongsi link produk tertentu
-- (/products/<slug>?aff=KOD). Customer (member/guest/LP) beli produk itu →
-- affiliate dapat komisen = line_subtotal × kadar_produk. Attribution last-click,
-- tetingkap masa (app_settings.affiliate_window_days). Ganti peranan earning
-- komisen lama (whole-order, customer-level). Refer-a-friend MATA (027) tak disentuh.
-- Guna semula: profiles.is_affiliate, affiliate_balance, affiliate_withdrawals,
-- RPC increment_affiliate_balance (028). Lihat src/lib/order-delivered.ts, lib/gift.ts N/A.
--
-- Additive. Idempotent — selamat dijalankan semula. Kod tahan bila lajur/nilai tiada.
-- ============================================================

-- 1) Kadar komisen PER PRODUK (0 = produk ini tak bayar komisen affiliate).
alter table public.products
  add column if not exists affiliate_pct numeric(5,4) not null default 0;
comment on column public.products.affiliate_pct is
  'Kadar komisen affiliate untuk produk ini (0..1). 0 = tiada komisen. Model C+B per produk.';

-- 2) Ledger attribution + komisen per baris (member & guest disatukan).
create table if not exists public.affiliate_attributions (
  id            uuid primary key default gen_random_uuid(),
  affiliate_id  uuid not null references public.profiles(id) on delete cascade,
  order_id      uuid not null,
  order_source  text not null default 'order' check (order_source in ('order','lp_guest')),
  product_id    uuid references public.products(id) on delete set null,
  line_subtotal numeric(10,2) not null,
  rate          numeric(5,4)  not null,              -- snapshot kadar masa beli
  amount        numeric(10,2) not null,              -- line_subtotal × rate
  status        text not null default 'pending' check (status in ('pending','credited','reversed')),
  clicked_at    timestamptz,
  created_at    timestamptz not null default now(),
  credited_at   timestamptz,
  unique (order_source, order_id, product_id, affiliate_id)   -- idempotent per (order,produk,affiliate)
);
create index if not exists idx_aff_attr_affiliate on public.affiliate_attributions(affiliate_id);
create index if not exists idx_aff_attr_order      on public.affiliate_attributions(order_source, order_id);
create index if not exists idx_aff_attr_status     on public.affiliate_attributions(status);

alter table public.affiliate_attributions enable row level security;
drop policy if exists "aff_attr: affiliate sees own"  on public.affiliate_attributions;
drop policy if exists "aff_attr: admin all"           on public.affiliate_attributions;
create policy "aff_attr: affiliate sees own" on public.affiliate_attributions
  for select using (affiliate_id = auth.uid() or public.is_admin());
create policy "aff_attr: admin all" on public.affiliate_attributions
  for all using (public.is_admin()) with check (public.is_admin());
-- Insert/kredit/reversal datang melalui API service-role (createAdminClient) sahaja.

-- 3) affiliate_applications — tutup gap kritikal (jadual dirujuk kod tapi TIADA migration).
--    Laluan mohon-sendiri (/jadi-ejen → admin "Permohonan" → lulus) akan error tanpa ini.
create table if not exists public.affiliate_applications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  message      text,
  admin_note   text,
  created_at   timestamptz not null default now(),
  processed_at timestamptz,
  unique (user_id)                                  -- satu permohonan aktif per user
);
create index if not exists idx_aff_app_status on public.affiliate_applications(status);

alter table public.affiliate_applications enable row level security;
drop policy if exists "aff_app: user sees own"  on public.affiliate_applications;
drop policy if exists "aff_app: admin all"      on public.affiliate_applications;
create policy "aff_app: user sees own" on public.affiliate_applications
  for select using (user_id = auth.uid() or public.is_admin());
create policy "aff_app: admin all" on public.affiliate_applications
  for all using (public.is_admin()) with check (public.is_admin());

-- 4) Tetapan: tetingkap attribution (hari). Last-click sah dalam tempoh ini.
insert into public.app_settings (key, value)
values ('affiliate_window_days', '30')
on conflict (key) do nothing;
