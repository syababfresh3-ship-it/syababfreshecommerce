-- ============================================================
-- 017 — Improvements
-- 1. Loyalty tier auto-advancement when spend increases
-- 2. orders.delivery_slot column (separate from notes)
-- 3. Storage bucket: product-images
-- 4. cancel_order() secure DB function
-- ============================================================

-- 1. Update increment_spend to also auto-advance loyalty tier
create or replace function increment_spend(uid uuid, amount numeric)
returns void
language plpgsql
security definer
as $$
begin
  update public.profiles
    set total_spend = total_spend + amount
    where id = uid;

  -- Auto-advance tier: pick highest tier where min_spend <= total_spend
  update public.profiles p
    set tier_id = (
      select t.id
      from public.loyalty_tiers t
      where t.min_spend <= p.total_spend
      order by t.min_spend desc
      limit 1
    )
    where p.id = uid;
end;
$$;

-- 2. Delivery slot as its own column
alter table public.orders
  add column if not exists delivery_slot text;

-- 3. Storage bucket for product images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Allow any authenticated admin to upload/delete
create policy "product-images: admin upload"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "product-images: admin delete"
  on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_admin());

-- Public read for all product images
create policy "product-images: public read"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- 4. Secure cancel_order function — server-side ownership + timing check
create or replace function cancel_order(p_order_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_order record;
begin
  select id, user_id, status, created_at
    into v_order
    from public.orders
    where id = p_order_id;

  if not found then
    return json_build_object('ok', false, 'error', 'Pesanan tidak dijumpai');
  end if;

  if v_order.user_id <> auth.uid() then
    return json_build_object('ok', false, 'error', 'Tidak dibenarkan');
  end if;

  if v_order.status not in ('pending', 'confirmed') then
    return json_build_object('ok', false, 'error', 'Pesanan tidak boleh dibatalkan');
  end if;

  if extract(epoch from now() - v_order.created_at) > 1800 then
    return json_build_object('ok', false, 'error', 'Masa batalkan telah tamat (30 minit)');
  end if;

  update public.orders
    set status = 'cancelled', cancelled_at = now()
    where id = p_order_id;

  return json_build_object('ok', true);
end;
$$;
