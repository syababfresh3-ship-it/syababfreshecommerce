-- ============================================================
-- 042_lp_guest_orders.sql
-- Order terus dari landing page — tanpa login
-- Pelanggan isi nama + telefon + alamat → confirm → selesai
-- ============================================================

create table if not exists public.lp_guest_orders (
  id            uuid        primary key default gen_random_uuid(),
  order_number  text        not null unique,
  page_id       uuid        not null references public.landing_pages(id) on delete restrict,

  -- Customer info
  name          text        not null,
  phone         text        not null,
  address       text        not null,
  postcode      text,
  notes         text,

  -- Product
  product_id    uuid        not null references public.products(id),
  variant_id    uuid        references public.product_variants(id),
  product_name  text        not null,
  variant_name  text,
  quantity      integer     not null check (quantity > 0),
  unit_price    numeric     not null,
  delivery_fee  numeric     not null default 0,
  total         numeric     not null,

  -- Payment & status
  payment_method text       not null default 'cod',
  status        text        not null default 'pending',   -- pending | confirmed | cancelled

  source        text,        -- utm_source / utm_campaign
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.lp_guest_orders enable row level security;

-- Admin boleh buat semua
create policy "Admin full access" on public.lp_guest_orders
  for all to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Public boleh insert (buat order baru)
create policy "Public insert" on public.lp_guest_orders
  for insert with check (true);

-- Fungsi jana order number: LP-YYYYMMDD-XXXX
create or replace function public.generate_lp_order_number()
returns text language plpgsql as $$
declare
  v_date  text := to_char(now(), 'YYYYMMDD');
  v_seq   integer;
  v_num   text;
begin
  select coalesce(max(
    (regexp_match(order_number, 'LP-\d{8}-(\d+)'))[1]::integer
  ), 0) + 1
  into v_seq
  from public.lp_guest_orders
  where order_number like 'LP-' || v_date || '-%';

  v_num := 'LP-' || v_date || '-' || lpad(v_seq::text, 4, '0');
  return v_num;
end;
$$;
