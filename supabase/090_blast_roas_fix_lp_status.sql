-- ============================================================
-- 090_blast_roas_fix_lp_status.sql
-- FIX: attribution blast untuk lp_guest_orders tertinggal order yang dah
-- maju melepasi 'confirmed' (preparing/delivering/DELIVERED). Majoriti order
-- berakhir 'delivered' → tak dikira → revenue blast under-count teruk.
-- Luaskan filter LP supaya selari dengan cabang storefront (full lifecycle).
-- ADDITIVE (create or replace view). Idempotent. Run di Supabase SQL Editor.
-- Bergantung pada 084 (wa_norm_phone) + 085. Run selepas 085.
-- ============================================================

create or replace view public.crm_blast_order_attribution as
select distinct on (u.order_id)
  u.order_id,
  u.order_number,
  u.total,
  u.order_created_at,
  u.blast_id,
  u.wa_id,
  u.blast_sent_at
from (
  -- LP / CRM / Quick Order (lp_guest_orders) — phone terus pada order
  select
    o.id          as order_id,
    o.order_number,
    o.total,
    o.created_at  as order_created_at,
    r.blast_id,
    r.wa_id,
    r.sent_at     as blast_sent_at
  from public.lp_guest_orders o
  join public.crm_blast_recipients r
    on public.wa_norm_phone(r.wa_id) = public.wa_norm_phone(o.phone)
   and r.status in ('sent','delivered','read')
   and r.sent_at is not null
   and o.created_at >= r.sent_at
   and o.created_at <= r.sent_at + interval '7 days'
  -- DULU: ('confirmed','paid') sahaja → tertinggal delivered/delivering/preparing.
  where o.status in ('confirmed','paid','preparing','delivering','delivered')

  union all

  -- Storefront (public.orders) — phone via profiles (orders.user_id = profiles.id)
  select
    o.id          as order_id,
    o.order_number,
    o.total,
    o.created_at  as order_created_at,
    r.blast_id,
    r.wa_id,
    r.sent_at     as blast_sent_at
  from public.orders o
  join public.profiles p
    on p.id = o.user_id
  join public.crm_blast_recipients r
    on public.wa_norm_phone(r.wa_id) = public.wa_norm_phone(p.phone)
   and r.status in ('sent','delivered','read')
   and r.sent_at is not null
   and o.created_at >= r.sent_at
   and o.created_at <= r.sent_at + interval '7 days'
  where o.status in ('confirmed','preparing','delivering','delivered')
) u
order by u.order_id, u.blast_sent_at desc;  -- last-touch, tiada double-count

-- WAJIB selepas setiap `create or replace view`: klausa itu RESET reloptions ke
-- default (security_invoker = off = kelakuan SECURITY DEFINER), jadi ia membatalkan
-- 089. Ditambah 2026-07-20 selepas Security Advisor tangkap regression ini.
alter view public.crm_blast_order_attribution set (security_invoker = on);
