-- Deduct inventory FIFO (oldest batch first) when order is placed
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
  -- Loop through batches oldest-first, non-expired, with stock > 0
  for v_batch in
    select id, quantity
    from inventory_batches
    where product_id = p_product_id
      and expiry_date >= current_date
      and quantity > 0
    order by batch_date asc, created_at asc
  loop
    exit when v_remaining <= 0;

    v_deduct := least(v_batch.quantity, v_remaining);

    update inventory_batches
    set quantity = quantity - v_deduct
    where id = v_batch.id;

    v_remaining := v_remaining - v_deduct;
  end loop;

  -- If still remaining (oversold), just log — don't fail the order
  if v_remaining > 0 then
    raise warning 'deduct_inventory: oversold product % by %', p_product_id, v_remaining;
  end if;
end;
$$;
