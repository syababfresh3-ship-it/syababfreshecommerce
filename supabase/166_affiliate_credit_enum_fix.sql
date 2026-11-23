-- 166: Pembetulan affiliate_credit_due — orders.status / orders.payment_status ialah ENUM
-- (order_status / payment_status). `coalesce(o.payment_status, '')` cuba tukar '' kepada enum →
-- "invalid input value for enum payment_status: """ (cron affiliate-credit gagal 23 Nov 2026 13:20 UTC).
-- Semua perbandingan kini melalui ::text — selamat untuk enum (orders) dan text (lp_guest_orders).
-- Idempoten. Jalankan di Supabase SQL Editor.

create or replace function public.affiliate_credit_due(p_limit integer default 300)
returns table (affiliate_id uuid, total numeric, n integer)
language plpgsql security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  -- Sapu pending yang ordernya dibatalkan/refund melalui laluan lain.
  update public.affiliate_attributions a
     set status = 'reversed', reversed_at = now(), reversed_reason = 'order_cancelled'
   where a.status = 'pending'
     and (
       (a.order_source = 'order' and exists (
          select 1 from public.orders o
           where o.id = a.order_id
             and (o.status::text in ('cancelled','refunded') or o.payment_status::text = 'refunded')))
       or
       (a.order_source = 'lp_guest' and exists (
          select 1 from public.lp_guest_orders l
           where l.id = a.order_id
             and (l.status::text in ('cancelled','refunded') or l.payment_status::text = 'refunded')))
     );

  return query
  with due as (
    select a.id, a.affiliate_id as aff, a.amount, a.order_source, a.order_id
      from public.affiliate_attributions a
     where a.status = 'pending' and a.credit_after is not null and a.credit_after <= now()
     order by a.credit_after
     limit greatest(1, coalesce(p_limit, 300))
     for update skip locked
  ), judged as (
    select d.id, d.aff, d.amount,
      case when d.order_source = 'order'
           then exists (select 1 from public.orders o
                         where o.id = d.order_id and o.status::text = 'delivered'
                           and coalesce(o.payment_status::text, '') <> 'refunded')
           else exists (select 1 from public.lp_guest_orders l
                         where l.id = d.order_id and l.status::text = 'delivered'
                           and coalesce(l.payment_status::text, '') <> 'refunded')
      end as order_ok,
      exists (select 1 from public.profiles p where p.id = d.aff and p.is_affiliate) as aff_ok
      from due d
  ), voided as (
    update public.affiliate_attributions a
       set status = 'reversed', reversed_at = now(),
           reversed_reason = case when not j.order_ok then 'order_not_delivered' else 'affiliate_inactive' end
      from judged j
     where a.id = j.id and (not j.order_ok or not j.aff_ok)
     returning a.id
  ), credited as (
    update public.affiliate_attributions a
       set status = 'credited', credited_at = now()
      from judged j
     where a.id = j.id and j.order_ok and j.aff_ok
     returning a.affiliate_id as aff, a.amount
  ), sums as (
    select c.aff, sum(c.amount) as tot, count(*)::integer as cnt from credited c group by c.aff
  ), bumped as (
    update public.profiles p
       set affiliate_balance = p.affiliate_balance + s.tot
      from sums s
     where p.id = s.aff
     returning p.id as aff, s.tot, s.cnt
  )
  select b.aff, b.tot, b.cnt from bumped b;
end;
$$;

-- Kebenaran kekal seperti 165: service_role sahaja.
revoke execute on function public.affiliate_credit_due(integer) from public, anon, authenticated;
grant  execute on function public.affiliate_credit_due(integer) to service_role;

-- Bersihkan ralat lama pada heartbeat supaya dashboard tidak merah selepas pembetulan.
update public.cron_heartbeats set last_error = null, last_error_at = null where job = 'affiliate-credit';
