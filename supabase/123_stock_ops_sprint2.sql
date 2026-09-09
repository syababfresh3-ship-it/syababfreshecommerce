-- ============================================================
-- 123_stock_ops_sprint2.sql — stok & operasi (audit Sept 2026, Sprint 2)
--
-- §0.7  Order LP/tetamu kini potong stok (COD/bank: masa buat order;
--       FPX/kad: masa bayaran disahkan). Tanda stock_deducted_at supaya
--       sekali sahaja; stock_restored_at bila dibatalkan.
-- §4    Cancel (admin atau pelanggan) pulangkan stok melalui restore_stock()
--       — satu laluan dalam kod TS. cancel_order() ditakrif semula TANPA
--       pemulihan stok (versi 023 pulangkan sebagai batch 365 hari — salah
--       untuk buah segar, dan berganda dengan laluan TS).
-- §4    View product_stock_all: batch + stok varian (dulu produk bervarian
--       sentiasa 0 → amaran stok rendah jadi hingar).
-- §5    Indeks laluan panas (senarai/export/cron order, telefon tetamu).
--
-- Idempotent — selamat dijalankan semula.
-- ============================================================

-- ── Lajur penjejak stok ───────────────────────────────────────
alter table public.lp_guest_orders
  add column if not exists stock_deducted_at timestamptz,
  add column if not exists stock_restored_at timestamptz;
alter table public.orders
  add column if not exists stock_restored_at timestamptz;

-- ── restore_stock: pulangkan stok satu item (server sahaja) ───
-- Varian → stok varian + qty. Produk batch → tambah ke batch belum luput
-- terkini; kalau tiada, cipta batch baharu tempoh 7 hari (bukan 365).
create or replace function public.restore_stock(p_product_id uuid, p_variant_id uuid, p_quantity integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch uuid;
begin
  if p_quantity is null or p_quantity <= 0 then return; end if;

  if p_variant_id is not null then
    update public.product_variants set stock = coalesce(stock, 0) + p_quantity where id = p_variant_id;
    return;
  end if;

  select id into v_batch
    from public.inventory_batches
   where product_id = p_product_id and expiry_date >= current_date
   order by expiry_date desc, created_at desc
   limit 1;

  if v_batch is not null then
    update public.inventory_batches set quantity = quantity + p_quantity where id = v_batch;
  else
    insert into public.inventory_batches (product_id, quantity, batch_date, expiry_date, notes)
    values (p_product_id, p_quantity, current_date, current_date + 7, 'Pulangan dari pembatalan order');
  end if;
end;
$$;

revoke execute on function public.restore_stock(uuid, uuid, integer) from public, anon, authenticated;
grant  execute on function public.restore_stock(uuid, uuid, integer) to service_role;

-- ── cancel_order: pelanggan batal sendiri (≤30 min, pemilik sahaja), TANPA pulang stok
--    (stok dipulangkan oleh API /api/orders/[id]/cancel melalui restore_stock)
create or replace function public.cancel_order(p_order_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
begin
  select id, user_id, status, created_at into v_order from public.orders where id = p_order_id;
  if not found then
    return json_build_object('ok', false, 'error', 'Pesanan tidak dijumpai');
  end if;
  if v_order.user_id is null or v_order.user_id <> auth.uid() then
    return json_build_object('ok', false, 'error', 'Tidak dibenarkan');
  end if;
  if v_order.status not in ('pending', 'confirmed') then
    return json_build_object('ok', false, 'error', 'Pesanan tidak boleh dibatalkan');
  end if;
  if extract(epoch from now() - v_order.created_at) > 1800 then
    return json_build_object('ok', false, 'error', 'Masa batalkan telah tamat (30 minit)');
  end if;

  update public.orders set status = 'cancelled', cancelled_at = now() where id = p_order_id;
  return json_build_object('ok', true);
end;
$$;

revoke execute on function public.cancel_order(uuid) from public, anon;
grant  execute on function public.cancel_order(uuid) to authenticated, service_role;

-- ── product_stock_all: batch + varian (+ is_active untuk tapis di dashboard) ───
create or replace view public.product_stock_all as
select
  p.id as product_id,
  coalesce(b.batch_stock, 0)::integer   as batch_stock,
  coalesce(v.variant_stock, 0)::integer as variant_stock,
  (coalesce(b.batch_stock, 0) + coalesce(v.variant_stock, 0))::integer as available_stock,
  (v.product_id is not null) as has_variants,
  p.is_active
from public.products p
left join (
  select product_id, sum(quantity) as batch_stock
  from public.inventory_batches
  where expiry_date >= current_date and quantity > 0
  group by product_id
) b on b.product_id = p.id
left join (
  select product_id, sum(coalesce(stock, 0)) as variant_stock
  from public.product_variants
  where is_active
  group by product_id
) v on v.product_id = p.id;

-- AGENTS.md: setiap create or replace view mesti diikuti security_invoker
alter view public.product_stock_all set (security_invoker = on);

-- ── Indeks laluan panas ───────────────────────────────────────
create index if not exists idx_orders_created_at            on public.orders (created_at desc);
create index if not exists idx_orders_status_created         on public.orders (status, created_at desc);
create index if not exists idx_orders_pay_method_created     on public.orders (payment_status, payment_method, created_at desc);
create index if not exists idx_lp_orders_phone               on public.lp_guest_orders (phone);
create index if not exists idx_lp_orders_status_created      on public.lp_guest_orders (status, created_at desc);
create index if not exists idx_lp_orders_pay_method_created  on public.lp_guest_orders (payment_status, payment_method, created_at desc);
create index if not exists idx_order_items_product           on public.order_items (product_id);
create index if not exists idx_customers_last_order_at       on public.customers (last_order_at desc);
create index if not exists idx_push_subscriptions_user       on public.push_subscriptions (user_id);
