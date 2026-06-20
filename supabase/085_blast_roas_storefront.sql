-- ============================================================
-- 085_blast_roas_storefront.sql
-- Luaskan attribution Blast ROAS supaya termasuk order STOREFRONT
-- (jadual public.orders) — selain lp_guest_orders/CRM/quick-order.
-- Storefront tiada kolum phone; nombor diambil dari profiles via user_id.
-- ADDITIVE (create or replace view). Idempotent. Run di Supabase SQL Editor.
-- Bergantung pada 084 (wa_norm_phone, crm_blast_roas). Run 084 dulu.
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
  where o.status in ('confirmed','paid')

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
