-- ============================================================
-- SYABABFRESH — Row Level Security (RLS) Policies
-- Run AFTER 001_schema.sql
-- ============================================================

-- Enable RLS on all tables
alter table public.profiles             enable row level security;
alter table public.loyalty_tiers        enable row level security;
alter table public.categories           enable row level security;
alter table public.products             enable row level security;
alter table public.inventory_batches    enable row level security;
alter table public.addresses            enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.cart_items           enable row level security;
alter table public.loyalty_transactions enable row level security;

-- Helper: check if current user is admin
create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  )
$$;

-- ============================================================
-- LOYALTY TIERS — public read
-- ============================================================
create policy "loyalty_tiers: anyone can read"
  on public.loyalty_tiers for select using (true);

create policy "loyalty_tiers: admin full access"
  on public.loyalty_tiers for all using (public.is_admin());

-- ============================================================
-- CATEGORIES — public read
-- ============================================================
create policy "categories: anyone can read active"
  on public.categories for select using (is_active = true or public.is_admin());

create policy "categories: admin full access"
  on public.categories for all using (public.is_admin());

-- ============================================================
-- PRODUCTS — public read active, admin full access
-- ============================================================
create policy "products: anyone can read active"
  on public.products for select using (is_active = true or public.is_admin());

create policy "products: admin full access"
  on public.products for all using (public.is_admin());

-- ============================================================
-- INVENTORY BATCHES — admin only
-- ============================================================
create policy "inventory: admin full access"
  on public.inventory_batches for all using (public.is_admin());

-- ============================================================
-- PROFILES — own row or admin
-- ============================================================
create policy "profiles: user can read own"
  on public.profiles for select using (id = auth.uid() or public.is_admin());

create policy "profiles: user can update own"
  on public.profiles for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and is_admin = (select is_admin from public.profiles where id = auth.uid())
  );

create policy "profiles: admin full access"
  on public.profiles for all using (public.is_admin());

-- ============================================================
-- ADDRESSES — own or admin
-- ============================================================
create policy "addresses: user owns"
  on public.addresses for all using (user_id = auth.uid() or public.is_admin());

-- ============================================================
-- ORDERS — own or admin
-- ============================================================
create policy "orders: user can read own"
  on public.orders for select using (user_id = auth.uid() or public.is_admin());

create policy "orders: user can insert own"
  on public.orders for insert with check (user_id = auth.uid());

create policy "orders: admin can update"
  on public.orders for update using (public.is_admin());

-- ============================================================
-- ORDER ITEMS — via order ownership
-- ============================================================
create policy "order_items: user can read via order"
  on public.order_items for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "order_items: insert on own order"
  on public.order_items for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = auth.uid()
    )
  );

create policy "order_items: admin full access"
  on public.order_items for all using (public.is_admin());

-- ============================================================
-- CART ITEMS — own only
-- ============================================================
create policy "cart: user owns"
  on public.cart_items for all using (user_id = auth.uid());

-- ============================================================
-- LOYALTY TRANSACTIONS — own or admin
-- ============================================================
create policy "loyalty_tx: user can read own"
  on public.loyalty_transactions for select using (user_id = auth.uid() or public.is_admin());

create policy "loyalty_tx: admin full access"
  on public.loyalty_transactions for all using (public.is_admin());
