-- 065: Master customer (CRM) — satu sumber kebenaran tunggal untuk semua kenalan,
-- disatukan dari profiles + lp_guest_orders + landing_page_leads + orders (dan
-- kemudian TikTok, WhatsApp, website lain, import sheet). Identiti = phone_norm
-- (telefon ternormal 60xxxxxxxxx). Agregat order di-cache & disegar oleh upsert.
--
-- Idempotent — selamat dijalankan semula. Jalankan di Supabase SQL Editor.

-- ── master ───────────────────────────────────────────────────────────────────
create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  phone_norm    text not null unique,            -- 60xxxxxxxxx (kanonik)
  name          text,
  email         text,
  address       text,
  postcode      text,
  user_id       uuid references public.profiles(id) on delete set null,
  sources       text[] not null default '{}',    -- {store,lp,lead,tiktok,whatsapp,web,manual}
  tags          text[] not null default '{}',
  is_reseller   boolean not null default false,
  consent_wa    boolean,
  consent_email boolean,
  -- cache agregat (disegar oleh upsert / backfill)
  order_count   integer not null default 0,
  total_spend   numeric not null default 0,
  last_order_at timestamptz,
  first_seen_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists customers_is_reseller_idx on public.customers (is_reseller) where is_reseller;
create index if not exists customers_user_id_idx on public.customers (user_id);

-- ── nota CRM (timeline) ──────────────────────────────────────────────────────
create table if not exists public.customer_notes (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  body        text not null,
  author      text,
  created_at  timestamptz not null default now()
);
create index if not exists customer_notes_customer_idx on public.customer_notes (customer_id, created_at desc);

-- ── reseller (1-1 dgn customer, model penuh) ─────────────────────────────────
create table if not exists public.resellers (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null unique references public.customers(id) on delete cascade,
  status          text not null default 'pending',  -- pending|active|suspended
  wholesale_tier  text,                              -- rujukan tier harga borong
  commission_rate numeric not null default 0,        -- peratus, cth 10 = 10%
  territory       text,
  joined_at       date,
  agreement_notes text,
  referral_code   text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── audit import luar (Fasa 2) ───────────────────────────────────────────────
create table if not exists public.import_batches (
  id         uuid primary key default gen_random_uuid(),
  source     text not null,        -- whatsapp|web|sheet|manual
  filename   text,
  row_count  integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- RLS: admin penuh via service role (server). Aktifkan & kunci ke service role.
alter table public.customers      enable row level security;
alter table public.customer_notes enable row level security;
alter table public.resellers      enable row level security;
alter table public.import_batches enable row level security;
-- Tiada policy untuk anon/authenticated → hanya service_role (server) boleh akses.
