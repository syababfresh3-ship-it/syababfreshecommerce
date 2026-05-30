-- ============================================================
-- 054_refunds.sql
-- Modul refund standalone (port dari syababfresh-app, generik semua produk).
--   refunds        — header (1 refund per order, partial dibenarkan)
--   refund_items   — line item (datang dari order_items order yang dipilih)
-- Cara bayar: transfer / baucar (kredit points) / ganti_produk.
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────
do $$ begin
  create type public.refund_calc_method as enum ('per_unit', 'percentage');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.refund_payment_method as enum ('transfer', 'baucar', 'ganti_produk');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.refund_status as enum ('pending', 'processing', 'selesai');
exception when duplicate_object then null; end $$;

-- ── Header ───────────────────────────────────────────────────
create table if not exists public.refunds (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  deadline      timestamptz not null default (now() + interval '3 days'),
  resolved_at   timestamptz,

  -- Wajib link order storefront (partial/berbilang dibenarkan — bukan unique)
  order_id      uuid not null references public.orders(id) on delete cascade,
  order_number  text,
  customer_name text,
  customer_phone text,
  tracking_no   text,

  -- Pemprosesan
  pic_name      text,
  supplier_code text,
  supplier_cost numeric(10,2),
  supplier_claim numeric(10,2),

  -- Jumlah
  harga_total   numeric(10,2) not null default 0,
  jumlah_refund numeric(10,2) not null default 0,
  reason        text,

  -- Cara bayar balik
  payment_method public.refund_payment_method not null,
  baucar_kod    text,
  baucar_points integer,
  bank_name     text,
  bank_account_no text,
  bank_account_name text,

  -- Ganti produk (replacement shipment)
  ganti_qty        integer,
  ganti_variation  text,
  ganti_alamat     text,
  ganti_postcode   text,
  ganti_courier    text,
  ganti_tracking_no text,
  ganti_tracking_link text,

  -- Bukti & catatan
  image_urls    text[] not null default '{}',
  notes         text,

  status        public.refund_status not null default 'pending',
  loyalty_credited boolean not null default false  -- idempotency kredit baucar points
);

create index if not exists idx_refunds_status     on public.refunds(status);
create index if not exists idx_refunds_order       on public.refunds(order_id);
create index if not exists idx_refunds_created     on public.refunds(created_at desc);

-- ── Line items ───────────────────────────────────────────────
create table if not exists public.refund_items (
  id            uuid primary key default gen_random_uuid(),
  refund_id     uuid not null references public.refunds(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete set null,
  product_name  text not null,
  variant_name  text,
  unit_price    numeric(10,2) not null default 0,
  quantity      integer not null default 1,
  calc_method   public.refund_calc_method not null default 'per_unit',
  rosak_qty     integer,
  percent_rosak numeric(5,2),
  item_refund   numeric(10,2) not null default 0,
  ganti_saiz    text
);

create index if not exists idx_refund_items_refund on public.refund_items(refund_id);

-- ── RLS — admin sahaja (route guna service-role, ini lapisan tambahan) ──
alter table public.refunds      enable row level security;
alter table public.refund_items enable row level security;

drop policy if exists "Admin full access refunds" on public.refunds;
create policy "Admin full access refunds" on public.refunds
  for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "Admin full access refund_items" on public.refund_items;
create policy "Admin full access refund_items" on public.refund_items
  for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
