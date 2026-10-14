-- ============================================================
-- 137_gift_studio.sql — Gift Studio Kurma (konfigurator custom giftbox + tempahan)
-- 30 Sep 2026. Pelan: plans/indexed-riding-naur.md
--
-- Modul TERASING dari kedai: jadual gift_* sendiri (BUKAN products/orders).
-- Customer reka gift (kotak + design + isi kurma + kuantiti) → harga hidup →
-- bayar deposit online (CHIP) ATAU hantar enquiry untuk admin sebut harga.
-- Admin urus katalog + kitaran tempahan (enquiry → confirmed → in_production →
-- ready → completed) + deposit/baki.
--
-- RLS: hidup untuk semua. Katalog boleh baca AWAM (konfigurator perlu tanpa login);
-- gift_orders service-role sahaja (sifar policy). Idempotent. Tiada view.
-- ============================================================

-- ── Katalog: kotak ──────────────────────────────────────────────────────────
create table if not exists public.gift_boxes (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           text unique,
  description    text,
  base_price     numeric(10,2) not null default 0,
  image_url      text,
  model_url      text,                       -- .glb untuk preview 3D (nullable → guna gambar)
  capacity_label text,                       -- cth "muat 6–12 pcs"
  tiers          jsonb,                      -- [{min_qty, unit_price}] harga pukal (nullable)
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ── Katalog: isi / kurma ────────────────────────────────────────────────────
create table if not exists public.gift_fillings (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  image_url   text,
  price       numeric(10,2) not null default 0,   -- harga per unit isi
  unit        text not null default 'pcs',         -- pcs | gram | box
  grade       text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Katalog: reka bentuk preset (pilihan) ───────────────────────────────────
create table if not exists public.gift_designs (
  id          uuid primary key default gen_random_uuid(),
  box_id      uuid references public.gift_boxes(id) on delete cascade,  -- null = universal
  name        text not null,
  image_url   text,
  price_add   numeric(10,2) not null default 0,   -- yuran design (0 = percuma)
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── Tempahan / enquiry ──────────────────────────────────────────────────────
create table if not exists public.gift_orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      text not null unique,
  channel           text not null default 'online',  -- online | manual
  -- Customer
  name              text not null,
  phone             text not null,
  email             text,
  company           text,
  address           text,
  postcode          text,
  delivery_method   text not null default 'delivery', -- delivery | pickup
  -- Konfigurasi: { box_id, design_id|null, custom_design_url|null, fillings:[{id,qty}], addons }
  config            jsonb not null default '{}',
  custom_design_url text,
  -- Harga
  quantity          integer not null default 1,
  unit_price        numeric(10,2) not null default 0,
  subtotal          numeric(10,2) not null default 0,
  delivery_fee      numeric(10,2) not null default 0,
  total             numeric(10,2) not null default 0,
  deposit_pct       integer not null default 50,
  deposit_amount    numeric(10,2) not null default 0,
  balance           numeric(10,2) not null default 0,
  -- Bayaran
  payment_ref       text,                             -- rujukan purchase CHIP semasa
  payment_status    text not null default 'unpaid',   -- unpaid | deposit_paid | paid | refunded
  -- Kitaran tempahan
  status            text not null default 'enquiry',  -- enquiry|quoted|confirmed|in_production|ready|completed|cancelled
  tracking_number   text,
  notes             text,                             -- nota customer
  admin_notes       text,
  created_by        uuid references public.profiles(id) on delete set null,  -- admin (manual)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_gift_orders_status     on public.gift_orders (status);
create index if not exists idx_gift_orders_created     on public.gift_orders (created_at desc);
create index if not exists idx_gift_orders_payment_ref on public.gift_orders (payment_ref) where payment_ref is not null;
create index if not exists idx_gift_boxes_sort         on public.gift_boxes (sort_order);
create index if not exists idx_gift_fillings_sort      on public.gift_fillings (sort_order);
create index if not exists idx_gift_designs_box        on public.gift_designs (box_id);

-- ── Nombor tempahan: GIFT-YYYYMMDD-NNNN (cermin generate_lp_order_number) ────
create or replace function public.generate_gift_order_number()
returns text language plpgsql as $$
declare
  v_date text := to_char(now(), 'YYYYMMDD');
  v_seq  integer;
begin
  select coalesce(max((regexp_match(order_number, 'GIFT-\d{8}-(\d+)'))[1]::integer), 0) + 1
  into v_seq
  from public.gift_orders
  where order_number like 'GIFT-' || v_date || '-%';
  return 'GIFT-' || v_date || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.gift_boxes    enable row level security;
alter table public.gift_fillings enable row level security;
alter table public.gift_designs  enable row level security;
alter table public.gift_orders   enable row level security;

-- Katalog: baca awam untuk item aktif (konfigurator tanpa login). Tulis = service-role.
drop policy if exists "gift_boxes public read"    on public.gift_boxes;
drop policy if exists "gift_fillings public read" on public.gift_fillings;
drop policy if exists "gift_designs public read"  on public.gift_designs;
create policy "gift_boxes public read"    on public.gift_boxes    for select using (is_active);
create policy "gift_fillings public read" on public.gift_fillings for select using (is_active);
create policy "gift_designs public read"  on public.gift_designs  for select using (is_active);
-- gift_orders: sifar policy → service-role sahaja (API guna createAdminClient).
