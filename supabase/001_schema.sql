-- ============================================================
-- SYABABFRESH — Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. LOYALTY TIERS
-- ============================================================
create table public.loyalty_tiers (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  min_spend   numeric(10,2) not null default 0,
  multiplier  numeric(4,2) not null default 1.0,
  perks       text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 2. PROFILES (extends auth.users)
-- ============================================================
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  phone         text,
  email         text,
  avatar_url    text,
  tier_id       uuid references public.loyalty_tiers(id) on delete set null,
  total_points  integer not null default 0,
  total_spend   numeric(10,2) not null default 0,
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- 3. CATEGORIES
-- ============================================================
create table public.categories (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text not null unique,
  description text,
  image_url   text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 4. PRODUCTS
-- ============================================================
create table public.products (
  id            uuid primary key default uuid_generate_v4(),
  category_id   uuid references public.categories(id) on delete set null,
  name          text not null,
  slug          text not null unique,
  description   text,
  price         numeric(10,2) not null,
  compare_price numeric(10,2),
  unit          text not null default 'kg',
  image_url     text,
  images        text[] default '{}',
  is_active     boolean not null default true,
  is_featured   boolean not null default false,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- 5. INVENTORY BATCHES
-- ============================================================
create table public.inventory_batches (
  id          uuid primary key default uuid_generate_v4(),
  product_id  uuid not null references public.products(id) on delete cascade,
  quantity    integer not null default 0,
  batch_date  date not null default current_date,
  expiry_date date not null,
  supplier    text,
  cost_price  numeric(10,2),
  notes       text,
  created_at  timestamptz not null default now()
);

-- View: available stock per product (non-expired batches)
create or replace view public.product_stock as
  select
    product_id,
    coalesce(sum(quantity), 0)::integer as available_stock
  from public.inventory_batches
  where expiry_date >= current_date
    and quantity > 0
  group by product_id;

-- ============================================================
-- 6. ADDRESSES
-- ============================================================
create table public.addresses (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  label            text not null default 'Rumah',
  recipient_name   text,
  recipient_phone  text,
  full_address     text not null,
  city             text,
  postcode         text,
  state            text,
  is_default       boolean not null default false,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- 7. ORDERS
-- ============================================================
create type public.order_status as enum (
  'pending', 'confirmed', 'preparing', 'delivering', 'delivered', 'cancelled', 'refunded'
);

create type public.payment_method as enum (
  'fpx', 'ewallet', 'cod', 'bank_transfer'
);

create type public.payment_status as enum (
  'unpaid', 'paid', 'refunded'
);

create table public.orders (
  id               uuid primary key default uuid_generate_v4(),
  order_number     text not null unique,
  user_id          uuid not null references auth.users(id) on delete restrict,
  status           public.order_status not null default 'pending',
  subtotal         numeric(10,2) not null,
  delivery_fee     numeric(10,2) not null default 0,
  discount         numeric(10,2) not null default 0,
  points_used      integer not null default 0,
  points_discount  numeric(10,2) not null default 0,
  total            numeric(10,2) not null,
  payment_method   public.payment_method not null,
  payment_status   public.payment_status not null default 'unpaid',
  payment_ref      text,
  address_id       uuid references public.addresses(id) on delete set null,
  delivery_address text,
  notes            text,
  admin_notes      text,
  confirmed_at     timestamptz,
  delivered_at     timestamptz,
  cancelled_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Auto-generate order number: SYB-YYYYMMDD-XXXX
create or replace function public.generate_order_number()
returns trigger language plpgsql as $$
declare
  v_date text;
  v_seq  integer;
begin
  v_date := to_char(now(), 'YYYYMMDD');
  select count(*) + 1
    into v_seq
    from public.orders
    where created_at::date = current_date;
  new.order_number := 'SYB-' || v_date || '-' || lpad(v_seq::text, 4, '0');
  return new;
end;
$$;

create trigger trg_order_number
  before insert on public.orders
  for each row execute function public.generate_order_number();

-- ============================================================
-- 8. ORDER ITEMS
-- ============================================================
create table public.order_items (
  id             uuid primary key default uuid_generate_v4(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  product_id     uuid references public.products(id) on delete set null,
  product_name   text not null,
  product_image  text,
  quantity       integer not null,
  unit_price     numeric(10,2) not null,
  subtotal       numeric(10,2) not null,
  created_at     timestamptz not null default now()
);

-- ============================================================
-- 9. CART ITEMS (server-side sync)
-- ============================================================
create table public.cart_items (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  quantity    integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(user_id, product_id)
);

-- ============================================================
-- 10. LOYALTY TRANSACTIONS
-- ============================================================
create type public.loyalty_tx_type as enum ('earn', 'redeem', 'bonus', 'adjustment');

create table public.loyalty_transactions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete set null,
  points      integer not null,
  type        public.loyalty_tx_type not null,
  description text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_products_category   on public.products(category_id);
create index idx_products_slug       on public.products(slug);
create index idx_products_active     on public.products(is_active);
create index idx_orders_user         on public.orders(user_id);
create index idx_orders_status       on public.orders(status);
create index idx_order_items_order   on public.order_items(order_id);
create index idx_inventory_product   on public.inventory_batches(product_id);
create index idx_cart_user           on public.cart_items(user_id);
create index idx_loyalty_user        on public.loyalty_transactions(user_id);

-- ============================================================
-- updated_at AUTO-UPDATE TRIGGER
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create trigger trg_cart_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email
  );
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
