-- ============================================================
-- SYABABFRESH — Reset (DROP ALL)
-- Run ini DULU sebelum 001_schema.sql jika nak start fresh
-- WARNING: Semua data akan PADAM
-- ============================================================

-- Drop triggers
drop trigger if exists trg_on_auth_user_created on auth.users;
drop trigger if exists trg_profiles_updated_at  on public.profiles;
drop trigger if exists trg_products_updated_at  on public.products;
drop trigger if exists trg_orders_updated_at    on public.orders;
drop trigger if exists trg_cart_updated_at      on public.cart_items;
drop trigger if exists trg_order_number         on public.orders;

-- Drop functions (CASCADE akan drop triggers yang bergantung)
drop function if exists public.handle_new_user()      cascade;
drop function if exists public.generate_order_number() cascade;
drop function if exists public.set_updated_at()        cascade;
drop function if exists public.is_admin()              cascade;

-- Drop views
drop view if exists public.product_stock;

-- Drop tables (ikut order FK)
drop table if exists public.loyalty_transactions cascade;
drop table if exists public.cart_items          cascade;
drop table if exists public.order_items         cascade;
drop table if exists public.orders              cascade;
drop table if exists public.addresses           cascade;
drop table if exists public.inventory_batches   cascade;
drop table if exists public.products            cascade;
drop table if exists public.categories          cascade;
drop table if exists public.profiles            cascade;
drop table if exists public.loyalty_tiers       cascade;

-- Drop types
drop type if exists public.loyalty_tx_type cascade;
drop type if exists public.payment_status  cascade;
drop type if exists public.payment_method  cascade;
drop type if exists public.order_status    cascade;
