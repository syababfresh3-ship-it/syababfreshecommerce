-- ============================================================
-- 016 — Fix Critical Bugs
-- 1. deduct_inventory: raise EXCEPTION on oversell + row locking
-- 2. orders: add promo_code_id column for webhook tracking
-- 3. delivery_zones: ensure is_active defaults to true
-- ============================================================

-- Bug 1: deduct_inventory — block oversell with row-level lock
create or replace function deduct_inventory(p_product_id uuid, p_quantity int)
returns void
language plpgsql
security definer
as $$
declare
  v_remaining int := p_quantity;
  v_batch     record;
  v_deduct    int;
begin
  for v_batch in
    select id, quantity
    from inventory_batches
    where product_id = p_product_id
      and expiry_date >= current_date
      and quantity > 0
    order by batch_date asc, created_at asc
    for update
  loop
    exit when v_remaining <= 0;
    v_deduct := least(v_batch.quantity, v_remaining);
    update inventory_batches
      set quantity = quantity - v_deduct
      where id = v_batch.id;
    v_remaining := v_remaining - v_deduct;
  end loop;

  if v_remaining > 0 then
    raise exception 'Stok tidak mencukupi. Produk: %, Kekurangan: % unit', p_product_id, v_remaining
      using errcode = 'P0001';
  end if;
end;
$$;

-- Bug 2: add promo_code_id to orders so webhook can increment promo uses after payment
alter table public.orders
  add column if not exists promo_code_id uuid references public.promo_codes(id) on delete set null;

-- Bug 3: ensure delivery_zones.is_active defaults true and all seeded rows are active
alter table public.delivery_zones
  alter column is_active set default true;

update public.delivery_zones
  set is_active = true
  where is_active is null;
