-- ============================================================
-- 051_lp_retro_claim.sql
-- Retroactive loyalty: bila customer daftar (telefon ditangkap), order LP lama
-- yang sudah DELIVERED tapi belum dikira points boleh dituntut.
-- Fungsi ni pulangkan calon order; award sebenar dibuat oleh awardLpLoyalty (app).
-- ============================================================

create or replace function public.lp_orders_for_phone(p_phone text)
returns table(id uuid, order_number text, phone text, total numeric)
language sql stable as $$
  select o.id, o.order_number, o.phone, o.total
  from public.lp_guest_orders o
  where o.status = 'delivered'
    and o.loyalty_awarded = false
    and length(regexp_replace(coalesce(o.phone, ''), '\D', '', 'g')) >= 9
    and right(regexp_replace(o.phone, '\D', '', 'g'), 9)
      = right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9)
  limit 50;
$$;
