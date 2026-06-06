-- 067: Modul Reseller (borong B2B) — harga dipersetujui per reseller + invois per-order.
-- Reseller = pembeli borong (bukan affiliate/referral). Dia dapat harga dirunding,
-- order diproses, invois PDF dijana. Idempotent — selamat dijalankan semula.

-- ── harga borong dipersetujui (per reseller, per produk/variant) ──────────────
create table if not exists public.reseller_prices (
  id          uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.resellers(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  variant_id  uuid references public.product_variants(id) on delete cascade,
  price       numeric not null check (price >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- Satu harga per (reseller, produk, variant). variant null = harga produk asas.
-- coalesce sebab NULL != NULL dalam unique biasa.
create unique index if not exists reseller_prices_unq
  on public.reseller_prices (reseller_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ── tag order borong ──────────────────────────────────────────────────────────
alter table public.lp_guest_orders add column if not exists reseller_id uuid references public.resellers(id) on delete set null;
create index if not exists lp_guest_orders_reseller_idx on public.lp_guest_orders (reseller_id) where reseller_id is not null;

-- ── invois reseller (satu per order) ──────────────────────────────────────────
create table if not exists public.reseller_invoices (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null unique references public.lp_guest_orders(id) on delete cascade,
  reseller_id    uuid not null references public.resellers(id) on delete cascade,
  invoice_number text not null unique,
  total          numeric not null default 0,
  status         text not null default 'issued',  -- issued | paid
  issued_at      timestamptz not null default now(),
  paid_at        timestamptz
);

-- ── jana no. invois: INV-YYYYMMDD-XXXX ────────────────────────────────────────
create or replace function public.generate_invoice_number()
returns text language plpgsql as $$
declare
  v_date text := to_char(now(), 'YYYYMMDD');
  v_seq  integer;
begin
  select coalesce(max((regexp_match(invoice_number, 'INV-\d{8}-(\d+)'))[1]::integer), 0) + 1
    into v_seq
  from public.reseller_invoices
  where invoice_number like 'INV-' || v_date || '-%';
  return 'INV-' || v_date || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- RLS: hanya service role (server) akses
alter table public.reseller_prices   enable row level security;
alter table public.reseller_invoices enable row level security;
